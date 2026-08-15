/*
    💣 BOMB TAG
    2 PLAYER REAL-TIME MULTIPLAYER

    Host:
        Creates the room.
        Controls the game state.
        Sends state to player 2.

    Guest:
        Sends movement input.
        Receives game state.

    PeerJS is used for WebRTC communication.
*/

const CONFIG = {
    PEER_PREFIX: "bombtag-",

    CANVAS_WIDTH: 900,
    CANVAS_HEIGHT: 560,

    PLAYER_RADIUS: 24,
    PLAYER_SPEED: 260,

    BOMB_RADIUS: 15,

    ROUND_TIME: 15,

    ROUNDS_TO_WIN: 5,

    TICK_RATE: 30,

    WORLD_PADDING: 35
};

/* =========================================================
   DOM
========================================================= */

const menuScreen = document.getElementById("menuScreen");
const lobbyScreen = document.getElementById("lobbyScreen");
const gameScreen = document.getElementById("gameScreen");

const nameInput = document.getElementById("nameInput");

const createBtn = document.getElementById("createBtn");
const showJoinBtn = document.getElementById("showJoinBtn");
const joinBtn = document.getElementById("joinBtn");

const joinArea = document.getElementById("joinArea");
const roomInput = document.getElementById("roomInput");

const menuMessage = document.getElementById("menuMessage");

const roomCodeElement = document.getElementById("roomCode");
const shareLink = document.getElementById("shareLink");

const copyBtn = document.getElementById("copyBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");

const playersElement = document.getElementById("players");

const lobbyMessage = document.getElementById("lobbyMessage");

const startBtn = document.getElementById("startBtn");
const leaveLobbyBtn = document.getElementById("leaveLobbyBtn");

const connectionStatus =
    document.getElementById("connectionStatus");

const hudRoom =
    document.getElementById("hudRoom");

const roundText =
    document.getElementById("roundText");

const timerText =
    document.getElementById("timerText");

const scoreText =
    document.getElementById("scoreText");

const bombStatus =
    document.getElementById("bombStatus");

const canvas =
    document.getElementById("gameCanvas");

const ctx =
    canvas.getContext("2d");

const countdown =
    document.getElementById("countdown");

const countdownNumber =
    document.getElementById("countdownNumber");

const roundResult =
    document.getElementById("roundResult");

const resultEmoji =
    document.getElementById("resultEmoji");

const resultTitle =
    document.getElementById("resultTitle");

const resultDescription =
    document.getElementById("resultDescription");

const nextRoundBtn =
    document.getElementById("nextRoundBtn");

const leaveGameBtn =
    document.getElementById("leaveGameBtn");

/* =========================================================
   STATE
========================================================= */

let peer = null;
let connection = null;

let isHost = false;

let myId = "";
let myName = "";

let roomCode = "";

let gameRunning = false;

let currentRound = 1;

let roundActive = false;

let lastFrame = performance.now();

let lastStateSend = 0;

const keys = {
    up: false,
    down: false,
    left: false,
    right: false
};

let players = {
    host: {
        x: 200,
        y: 280,
        name: "Host",
        score: 0
    },

    guest: {
        x: 700,
        y: 280,
        name: "Friend",
        score: 0
    }
};

let bombHolder = "host";

let roundTimeLeft =
    CONFIG.ROUND_TIME;

let roundWinner = null;

let guestInput = {
    up: false,
    down: false,
    left: false,
    right: false
};

/* =========================================================
   UTILITY
========================================================= */

function randomRoomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let result = "";

    for (let i = 0; i < 4; i++) {
        result +=
            chars[Math.floor(Math.random() * chars.length)];
    }

    return result;
}

function getName() {
    const name =
        nameInput.value.trim();

    if (!name) {
        return "Player";
    }

    return name.slice(0, 16);
}

function showScreen(screen) {
    menuScreen.classList.add("hidden");
    lobbyScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");

    screen.classList.remove("hidden");
}

function setConnectionStatus(connected) {
    if (connected) {
        connectionStatus.textContent = "Connected";
        connectionStatus.className =
            "status connected";
    } else {
        connectionStatus.textContent = "Disconnected";
        connectionStatus.className =
            "status disconnected";
    }
}

function setMessage(element, text) {
    element.textContent = text;
}

function getShareURL() {
    const url =
        new URL(window.location.href);

    url.searchParams.set(
        "room",
        roomCode
    );

    return url.toString();
}

function copyText(text) {
    navigator.clipboard
        .writeText(text)
        .catch(() => {
            alert("Copy failed. Select the text manually.");
        });
}

/* =========================================================
   MENU
========================================================= */

showJoinBtn.addEventListener("click", () => {
    joinArea.classList.toggle("hidden");

    if (!joinArea.classList.contains("hidden")) {
        roomInput.focus();
    }
});

createBtn.addEventListener("click", createRoom);

joinBtn.addEventListener("click", () => {
    joinRoom(
        roomInput.value.trim().toUpperCase()
    );
});

roomInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        joinRoom(
            roomInput.value
                .trim()
                .toUpperCase()
        );
    }
});

nameInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        createRoom();
    }
});

/* =========================================================
   CREATE ROOM
========================================================= */

function createRoom() {
    myName = getName();

    roomCode = randomRoomCode();

    isHost = true;

    setMessage(
        menuMessage,
        "Creating room..."
    );

    createPeerAsHost();
}

function createPeerAsHost() {
    const peerId =
        CONFIG.PEER_PREFIX +
        roomCode;

    peer = new Peer(peerId);

    peer.on("open", id => {
        myId = id;

        players.host.name = myName;

        roomCodeElement.textContent =
            roomCode;

        shareLink.value =
            getShareURL();

        hudRoom.textContent =
            roomCode;

        setConnectionStatus(true);

        showScreen(lobbyScreen);

        updateLobby();

        setMessage(
            lobbyMessage,
            "Send the room code or link to your friend."
        );
    });

    peer.on("connection", conn => {
        if (connection) {
            conn.close();
            return;
        }

        connection = conn;

        setupConnection();

        isHost = true;
    });

    peer.on("error", error => {
        console.error(error);

        setConnectionStatus(false);

        setMessage(
            menuMessage,
            "Could not create room."
        );
    });

    peer.on("disconnected", () => {
        setConnectionStatus(false);
    });
}

/* =========================================================
   JOIN ROOM
========================================================= */

function joinRoom(code) {
    if (!code || code.length !== 4) {
        setMessage(
            menuMessage,
            "Enter a 4-character room code."
        );

        return;
    }

    myName = getName();

    roomCode = code;

    isHost = false;

    setMessage(
        menuMessage,
        "Joining room..."
    );

    peer = new Peer();

    peer.on("open", id => {
        myId = id;

        const hostPeerId =
            CONFIG.PEER_PREFIX +
            roomCode;

        connection =
            peer.connect(
                hostPeerId,
                {
                    reliable: true
                }
            );

        setupConnection();
    });

    peer.on("error", error => {
        console.error(error);

        setConnectionStatus(false);

        setMessage(
            menuMessage,
            "Room not found. Check the code."
        );
    });
}

/* =========================================================
   CONNECTION
========================================================= */

function setupConnection() {
    if (!connection) {
        return;
    }

    connection.on("open", () => {
        setConnectionStatus(true);

        connection.send({
            type: "hello",
            name: myName
        });

        if (!isHost) {
            showScreen(lobbyScreen);
        }
    });

    connection.on("data", data => {
        handleNetworkMessage(data);
    });

    connection.on("close", () => {
        handleDisconnect();
    });

    connection.on("error", error => {
        console.error(error);
        handleDisconnect();
    });
}

function handleDisconnect() {
    setConnectionStatus(false);

    if (gameRunning) {
        gameRunning = false;

        alert(
            "Your friend disconnected."
        );
    }

    showScreen(menuScreen);

    connection = null;
}

/* =========================================================
   NETWORK MESSAGES
========================================================= */

function handleNetworkMessage(data) {
    if (!data || !data.type) {
        return;
    }

    if (data.type === "hello") {
        if (!isHost) {
            return;
        }

        players.guest.name =
            String(data.name || "Friend")
                .slice(0, 16);

        updateLobby();

        sendToGuest({
            type: "lobby",

            hostName:
                players.host.name,

            guestName:
                players.guest.name,

            canStart: true
        });

        return;
    }

    if (data.type === "input") {
        if (!isHost) {
            return;
        }

        guestInput = {
            up: !!data.input.up,
            down: !!data.input.down,
            left: !!data.input.left,
            right: !!data.input.right
        };

        return;
    }

    if (data.type === "startGame") {
        startClientGame(data.state);
        return;
    }

    if (data.type === "state") {
        applyGameState(data.state);
        return;
    }

    if (data.type === "roundResult") {
        showRoundResult(data);
        return;
    }

    if (data.type === "nextRound") {
        if (isHost) {
            startRound();
        }

        return;
    }

    if (data.type === "gameOver") {
        showGameOver(data);
        return;
    }
}

/* =========================================================
   SEND
========================================================= */

function sendToGuest(data) {
    if (
        connection &&
        connection.open
    ) {
        connection.send(data);
    }
}

/* =========================================================
   LOBBY
========================================================= */

function updateLobby() {
    playersElement.innerHTML = "";

    const host = document.createElement("div");

    host.className = "player";

    host.innerHTML = `
        <div>
            <div class="player-name">
                ${escapeHTML(players.host.name)}
            </div>
            <div class="player-role">
                Host
            </div>
        </div>

        <div>
            👑
        </div>
    `;

    playersElement.appendChild(host);

    if (players.guest.name !== "Friend") {
        const guest =
            document.createElement("div");

        guest.className = "player";

        guest.innerHTML = `
            <div>
                <div class="player-name">
                    ${escapeHTML(players.guest.name)}
                </div>
                <div class="player-role">
                    Player 2
                </div>
            </div>

            <div>
                🎮
            </div>
        `;

        playersElement.appendChild(guest);

        startBtn.disabled = false;
    } else {
        startBtn.disabled = true;
    }
}

function escapeHTML(text) {
    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* =========================================================
   COPY
========================================================= */

copyBtn.addEventListener("click", () => {
    copyText(roomCode);

    copyBtn.textContent = "Copied!";

    setTimeout(() => {
        copyBtn.textContent = "Copy";
    }, 1200);
});

copyLinkBtn.addEventListener("click", () => {
    copyText(
        shareLink.value
    );

    copyLinkBtn.textContent =
        "Copied!";

    setTimeout(() => {
        copyLinkBtn.textContent =
            "Copy Link";
    }, 1200);
});

/* =========================================================
   START BUTTON
========================================================= */

startBtn.addEventListener("click", () => {
    if (!isHost) {
        return;
    }

    if (
        !connection ||
        !connection.open
    ) {
        return;
    }

    startGame();
});

function startGame() {
    currentRound = 1;

    players.host.score = 0;
    players.guest.score = 0;

    gameRunning = true;

    showScreen(gameScreen);

    hudRoom.textContent =
        roomCode;

    if (isHost) {
        sendToGuest({
            type: "startGame",
            state: buildGameState()
        });

        startRound();
    }
}

function startClientGame(state) {
    gameRunning = true;

    showScreen(gameScreen);

    applyGameState(state);

    showCountdown(() => {});
}

/* =========================================================
   GAME
========================================================= */

function resetPositions() {
    players.host.x = 210;
    players.host.y =
        CONFIG.CANVAS_HEIGHT / 2;

    players.guest.x = 690;
    players.guest.y =
        CONFIG.CANVAS_HEIGHT / 2;
}

function startRound() {
    if (!isHost) {
        return;
    }

    currentRound++;

    if (currentRound === 2 &&
        players.host.score === 0 &&
        players.guest.score === 0) {
        currentRound = 1;
    }

    resetPositions();

    roundActive = false;

    roundTimeLeft =
        CONFIG.ROUND_TIME;

    roundWinner = null;

    bombHolder =
        Math.random() < 0.5
            ? "host"
            : "guest";

    showScreen(gameScreen);

    showCountdown(() => {
        roundActive = true;

        sendFullState();
    });
}

function showCountdown(callback) {
    countdown.classList.remove("hidden");

    let count = 3;

    countdownNumber.textContent =
        count;

    const interval =
        setInterval(() => {
            count--;

            if (count <= 0) {
                clearInterval(interval);

                countdownNumber.textContent =
                    "GO!";

                setTimeout(() => {
                    countdown.classList.add(
                        "hidden"
                    );

                    if (callback) {
                        callback();
                    }
                }, 450);

                return;
            }

            countdownNumber.textContent =
                count;

            countdownNumber.style.animation =
                "none";

            void countdownNumber.offsetWidth;

            countdownNumber.style.animation =
                "countPulse 1s ease-in-out";
        }, 1000);
}

function buildGameState() {
    return {
        host: {
            x: players.host.x,
            y: players.host.y,
            name: players.host.name,
            score: players.host.score
        },

        guest: {
            x: players.guest.x,
            y: players.guest.y,
            name: players.guest.name,
            score: players.guest.score
        },

        bombHolder,

        roundTimeLeft,

        round: currentRound
    };
}

function applyGameState(state) {
    if (!state) {
        return;
    }

    players.host.x =
        state.host.x;

    players.host.y =
        state.host.y;

    players.host.name =
        state.host.name;

    players.host.score =
        state.host.score;

    players.guest.x =
        state.guest.x;

    players.guest.y =
        state.guest.y;

    players.guest.name =
        state.guest.name;

    players.guest.score =
        state.guest.score;

    bombHolder =
        state.bombHolder;

    roundTimeLeft =
        state.roundTimeLeft;

    currentRound =
        state.round;

    updateHUD();
}

function sendFullState() {
    if (!isHost) {
        return;
    }

    sendToGuest({
        type: "state",
        state: buildGameState()
    });
}

/* =========================================================
   MOVEMENT
========================================================= */

window.addEventListener(
    "keydown",
    event => {
        setKey(event.key, true);

        if (
            [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                " "
            ].includes(event.key)
        ) {
            event.preventDefault();
        }
    }
);

window.addEventListener(
    "keyup",
    event => {
        setKey(event.key, false);
    }
);

function setKey(key, value) {
    switch (
        String(key).toLowerCase()
    ) {
        case "w":
        case "arrowup":
            keys.up = value;
            break;

        case "s":
        case "arrowdown":
            keys.down = value;
            break;

        case "a":
        case "arrowleft":
            keys.left = value;
            break;

        case "d":
        case "arrowright":
            keys.right = value;
            break;
    }
}

/* =========================================================
   HOST GAME SIMULATION
========================================================= */

function updateHost(dt) {
    if (!roundActive) {
        return;
    }

    updatePlayer(
        players.host,
        keys,
        dt
    );

    updatePlayer(
        players.guest,
        guestInput,
        dt
    );

    checkBombPassing();

    roundTimeLeft -= dt;

    if (roundTimeLeft <= 0) {
        roundTimeLeft = 0;

        explodeBomb();
    }
}

function updatePlayer(
    player,
    input,
    dt
) {
    let dx = 0;
    let dy = 0;

    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    if (input.up) dy -= 1;
    if (input.down) dy += 1;

    if (dx !== 0 || dy !== 0) {
        const length =
            Math.sqrt(
                dx * dx +
                dy * dy
            );

        dx /= length;
        dy /= length;
    }

    player.x +=
        dx *
        CONFIG.PLAYER_SPEED *
        dt;

    player.y +=
        dy *
        CONFIG.PLAYER_SPEED *
        dt;

    player.x = Math.max(
        CONFIG.WORLD_PADDING +
            CONFIG.PLAYER_RADIUS,

        Math.min(
            CONFIG.CANVAS_WIDTH -
                CONFIG.WORLD_PADDING -
                CONFIG.PLAYER_RADIUS,

            player.x
        )
    );

    player.y = Math.max(
        CONFIG.WORLD_PADDING +
            CONFIG.PLAYER_RADIUS,

        Math.min(
            CONFIG.CANVAS_HEIGHT -
                CONFIG.WORLD_PADDING -
                CONFIG.PLAYER_RADIUS,

            player.y
        )
    );
}

/* =========================================================
   BOMB
========================================================= */

function checkBombPassing() {
    const holder =
        players[bombHolder];

    const otherHolder =
        bombHolder === "host"
            ? "guest"
            : "host";

    const other =
        players[otherHolder];

    const dx =
        holder.x -
        other.x;

    const dy =
        holder.y -
        other.y;

    const distance =
        Math.sqrt(
            dx * dx +
            dy * dy
        );

    if (
        distance <
        CONFIG.PLAYER_RADIUS * 2
    ) {
        bombHolder =
            otherHolder;

        roundTimeLeft =
            Math.min(
                roundTimeLeft +
                    0.25,

                CONFIG.ROUND_TIME
            );
    }
}

function explodeBomb() {
    if (!isHost) {
        return;
    }

    roundActive = false;

    const loser =
        bombHolder;

    const winner =
        loser === "host"
            ? "guest"
            : "host";

    players[winner].score++;

    roundWinner = winner;

    sendToGuest({
        type: "roundResult",

        winner,

        loser,

        hostScore:
            players.host.score,

        guestScore:
            players.guest.score,

        round:
            currentRound
    });

    showRoundResult({
        winner,

        loser,

        hostScore:
            players.host.score,

        guestScore:
            players.guest.score,

        round:
            currentRound
    });

    sendFullState();
}

/* =========================================================
   RESULT
========================================================= */

function showRoundResult(data) {
    roundActive = false;

    const iWon =
        (isHost &&
            data.winner === "host") ||

        (!isHost &&
            data.winner === "guest");

    resultEmoji.textContent =
        iWon
            ? "🏆"
            : "💥";

    resultTitle.textContent =
        iWon
            ? "YOU WIN!"
            : "BOOM!";

    if (iWon) {
        resultDescription.textContent =
            "You escaped the bomb!";
    } else {
        resultDescription.textContent =
            "The bomb found you.";
    }

    roundResult.classList.remove(
        "hidden"
    );

    scoreText.textContent =
        `${data.hostScore} - ${data.guestScore}`;

    if (
        data.hostScore >=
            CONFIG.ROUNDS_TO_WIN ||
        data.guestScore >=
            CONFIG.ROUNDS_TO_WIN
    ) {
        nextRoundBtn.textContent =
            "Play Again";
    } else {
        nextRoundBtn.textContent =
            "Next Round";
    }
}

nextRoundBtn.addEventListener(
    "click",
    () => {
        roundResult.classList.add(
            "hidden"
        );

        if (isHost) {
            if (
                players.host.score >=
                    CONFIG.ROUNDS_TO_WIN ||
                players.guest.score >=
                    CONFIG.ROUNDS_TO_WIN
            ) {
                players.host.score = 0;
                players.guest.score = 0;

                currentRound = 1;

                startRound();

                sendToGuest({
                    type: "startGame",
                    state: buildGameState()
                });

                return;
            }

            startRound();

            sendToGuest({
                type: "state",
                state: buildGameState()
            });

            return;
        }

        sendToGuest({
            type: "nextRound"
        });
    }
);

/* =========================================================
   GAME OVER
========================================================= */

function showGameOver(data) {
    gameRunning = false;

    roundActive = false;

    roundResult.classList.remove(
        "hidden"
    );

    resultEmoji.textContent =
        data.winner ===
        (isHost ? "host" : "guest")
            ? "🏆"
            : "💥";

    resultTitle.textContent =
        data.winner ===
        (isHost ? "host" : "guest")
            ? "YOU WIN!"
            : "GAME OVER";

    nextRoundBtn.textContent =
        "Play Again";
}

/* =========================================================
   HUD
========================================================= */

function updateHUD() {
    roundText.textContent =
        `ROUND ${currentRound}`;

    timerText.textContent =
        roundTimeLeft.toFixed(1);

    scoreText.textContent =
        `${players.host.score} - ${players.guest.score}`;

    const myPlayer =
        isHost
            ? "host"
            : "guest";

    if (bombHolder === myPlayer) {
        bombStatus.textContent =
            "💣 YOU HAVE THE BOMB!";

        bombStatus.style.color =
            "#ff6464";
    } else {
        bombStatus.textContent =
            "🏃 Get away from the bomb!";

        bombStatus.style.color =
            "#63ff8f";
    }
}

/* =========================================================
   DRAW
========================================================= */

function draw() {
    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    drawBackground();

    drawArena();

    drawPlayer(
        players.host,
        "#6c7cff",
        "P1",
        bombHolder === "host"
    );

    drawPlayer(
        players.guest,
        "#ff6b8b",
        "P2",
        bombHolder === "guest"
    );

    drawCenterDecorations();
}

function drawBackground() {
    const gradient =
        ctx.createLinearGradient(
            0,
            0,
            0,
            canvas.height
        );

    gradient.addColorStop(
        0,
        "#111936"
    );

    gradient.addColorStop(
        1,
        "#0b1020"
    );

    ctx.fillStyle =
        gradient;

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.strokeStyle =
        "rgba(255,255,255,0.035)";

    ctx.lineWidth = 1;

    const gridSize = 40;

    for (
        let x = 0;
        x <= canvas.width;
        x += gridSize
    ) {
        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            canvas.height
        );

        ctx.stroke();
    }

    for (
        let y = 0;
        y <= canvas.height;
        y += gridSize
    ) {
        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            canvas.width,
            y
        );

        ctx.stroke();
    }
}

function drawArena() {
    ctx.strokeStyle =
        "rgba(255,255,255,0.13)";

    ctx.lineWidth = 3;

    ctx.strokeRect(
        CONFIG.WORLD_PADDING,
        CONFIG.WORLD_PADDING,
        CONFIG.CANVAS_WIDTH -
            CONFIG.WORLD_PADDING * 2,
        CONFIG.CANVAS_HEIGHT -
            CONFIG.WORLD_PADDING * 2
    );

    const centerX =
        CONFIG.CANVAS_WIDTH / 2;

    ctx.beginPath();

    ctx.moveTo(
        centerX,
        CONFIG.WORLD_PADDING
    );

    ctx.lineTo(
        centerX,
        CONFIG.CANVAS_HEIGHT -
            CONFIG.WORLD_PADDING
    );

    ctx.stroke();
}

function drawCenterDecorations() {
    ctx.beginPath();

    ctx.arc(
        CONFIG.CANVAS_WIDTH / 2,
        CONFIG.CANVAS_HEIGHT / 2,
        55,
        0,
        Math.PI * 2
    );

    ctx.strokeStyle =
        "rgba(255,255,255,0.06)";

    ctx.lineWidth = 2;

    ctx.stroke();
}

function drawPlayer(
    player,
    bodyColor,
    label,
    hasBomb
) {
    const x = player.x;
    const y = player.y;

    if (hasBomb) {
        const pulse =
            1 +
            Math.sin(
                performance.now() / 110
            ) *
            0.08;

        ctx.save();

        ctx.translate(
            x,
            y
        );

        ctx.scale(
            pulse,
            pulse
        );

        ctx.beginPath();

        ctx.arc(
            0,
            0,
            38,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            "rgba(255,75,75,0.14)";

        ctx.fill();

        ctx.restore();

        drawBomb(
            x,
            y - 38
        );
    }

    ctx.beginPath();

    ctx.arc(
        x,
        y,
        CONFIG.PLAYER_RADIUS,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        bodyColor;

    ctx.fill();

    ctx.lineWidth = 3;

    ctx.strokeStyle =
        "rgba(255,255,255,0.7)";

    ctx.stroke();

    ctx.fillStyle = "#ffffff";

    ctx.font =
        "800 12px Arial";

    ctx.textAlign =
        "center";

    ctx.fillText(
        player.name,
        x,
        y + 4
    );

    if (label) {
        ctx.font =
            "700 9px Arial";

        ctx.globalAlpha =
            0.55;

        ctx.fillText(
            label,
            x,
            y + 36
        );

        ctx.globalAlpha = 1;
    }
}

function drawBomb(x, y) {
    ctx.save();

    const scale =
        1 +
        Math.sin(
            performance.now() / 90
        ) *
        0.06;

    ctx.translate(
        x,
        y
    );

    ctx.scale(
        scale,
        scale
    );

    ctx.beginPath();

    ctx.arc(
        0,
        0,
        CONFIG.BOMB_RADIUS,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "#161616";

    ctx.fill();

    ctx.strokeStyle =
        "#ffffff";

    ctx.lineWidth = 2;

    ctx.stroke();

    ctx.beginPath();

    ctx.moveTo(
        5,
        -12
    );

    ctx.lineTo(
        10,
        -19
    );

    ctx.strokeStyle =
        "#777777";

    ctx.stroke();

    ctx.beginPath();

    ctx.arc(
        11,
        -20,
        3,
        0,
        Math.PI * 2
    );

    ctx.fillStyle =
        "#ffcc33";

    ctx.fill();

    ctx.restore();
}

/* =========================================================
   MAIN LOOP
========================================================= */

function loop(now) {
    const dt =
        Math.min(
            (now - lastFrame) / 1000,
            0.05
        );

    lastFrame = now;

    if (
        gameRunning &&
        isHost
    ) {
        updateHost(dt);

        if (
            now -
            lastStateSend >
            1000 /
                CONFIG.TICK_RATE
        ) {
            sendFullState();

            lastStateSend =
                now;
        }
    }

    if (
        gameRunning &&
        !isHost &&
        connection &&
        connection.open
    ) {
        sendInput();
    }

    updateHUD();

    draw();

    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

/* =========================================================
   INPUT NETWORKING
========================================================= */

let lastInputSend = 0;

function sendInput() {
    const now =
        performance.now();

    if (
        now -
        lastInputSend <
        1000 / 30
    ) {
        return;
    }

    lastInputSend = now;

    sendToGuest({
        type: "input",
        input: keys
    });
}

/*
    The guest uses the same function,
    but the host must receive it.
*/

function sendInputToHost() {
    if (
        connection &&
        connection.open
    ) {
        connection.send({
            type: "input",
            input: keys
        });
    }
}

/* =========================================================
   FIX GUEST INPUT
========================================================= */

const originalSendInput =
    sendInput;

sendInput = function () {
    if (!isHost) {
        sendInputToHost();
    }
};

/* =========================================================
   LEAVING
========================================================= */

leaveLobbyBtn.addEventListener(
    "click",
    leaveRoom
);

leaveGameBtn.addEventListener(
    "click",
    leaveRoom
);

function leaveRoom() {
    gameRunning = false;
    roundActive = false;

    if (connection) {
        connection.close();
    }

    if (peer) {
        peer.destroy();
    }

    connection = null;
    peer = null;

    setConnectionStatus(false);

    roomCode = "";

    roomCodeElement.textContent =
        "----";

    players.host.name =
        "Host";

    players.guest.name =
        "Friend";

    players.host.score = 0;
    players.guest.score = 0;

    currentRound = 1;

    showScreen(menuScreen);

    setMessage(
        menuMessage,
        ""
    );
}

/* =========================================================
   AUTO JOIN FROM URL
========================================================= */

window.addEventListener(
    "load",
    () => {
        const params =
            new URLSearchParams(
                window.location.search
            );

        const room =
            params
                .get("room")
                ?.toUpperCase();

        if (
            room &&
            room.length === 4
        ) {
            joinArea.classList.remove(
                "hidden"
            );

            roomInput.value =
                room;

            setMessage(
                menuMessage,
                `Room ${room} is ready to join!`
            );
        }
    }
);