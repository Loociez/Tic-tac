// ----------------- Globals -----------------
const ROWS = 6;
const COLS = 7;

let board = [];
let currentPlayer = "X";
let gameMode = null;
let isMyTurn = false;

let points = parseInt(localStorage.getItem("points")) || 0;
let boardsOwned = JSON.parse(localStorage.getItem("boards")) || ["default"];
let currentBoardStyle = localStorage.getItem("currentBoardStyle") || "default";
let playerThemesOwned = JSON.parse(localStorage.getItem("playerThemes")) || ["default"];
let currentPlayerTheme = localStorage.getItem("currentPlayerTheme") || "default";

let peer, conn;
let myId = null;

// ----------------- Elements -----------------
const boardDiv = document.getElementById("board");
const statusDiv = document.getElementById("status");
const newGameBtn = document.getElementById("new-game");
const pointsSpan = document.getElementById("points");
const singleBtn = document.getElementById("single-player");
const multiBtn = document.getElementById("multi-player");
const shopBtn = document.getElementById("shop-btn");
const shopDiv = document.getElementById("shop");
const closeShopBtn = document.getElementById("close-shop");
const boardStylesDiv = document.getElementById("board-styles");
const playerThemesDiv = document.getElementById("player-themes");
const inviteInput = document.getElementById("invite-link");
const copyBtn = document.getElementById("copy-link");

// ----------------- Init -----------------
pointsSpan.textContent = points;
updateBoardStylesUI();
updatePlayerThemesUI();
applyBoardStyle(currentBoardStyle);

// ----------------- Shop -----------------
shopBtn.onclick = () => shopDiv.style.display = "block";
closeShopBtn.onclick = () => shopDiv.style.display = "none";

// ----------------- Game Start -----------------
singleBtn.onclick = () => startGame("single");
multiBtn.onclick = () => startGame("multi");
newGameBtn.onclick = resetGame;

function startGame(mode) {
  gameMode = mode;
  setupBoard();
  newGameBtn.style.display = "none";
  currentPlayer = "X";
  isMyTurn = (mode === "single" || mode === "multi"); // host always starts
  statusDiv.textContent = currentPlayer + "'s move!";
  if (mode === "multi") setupMultiplayer();
}

// ----------------- Board -----------------
function setupBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  boardDiv.innerHTML = "";
  boardDiv.className = currentBoardStyle;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.col = c;
      cell.onclick = () => dropPiece(c);
      boardDiv.appendChild(cell);
    }
  }
}

// ----------------- Drop & Make Move -----------------
function dropPiece(col) {
  if (!isMyTurn) return;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) {
      makeMove(r, col, currentPlayer, true);
      return;
    }
  }
}

function makeMove(r, c, player, send) {
  if (board[r][c] !== null) return;

  board[r][c] = player;
  renderBoard();

  if (checkWin(player)) return;

  // switch player
  currentPlayer = player === "X" ? "O" : "X";
  statusDiv.textContent = currentPlayer + "'s move!";

  if (send) {
    if (gameMode === "multi" && conn) {
      conn.send({ r, c, player });
      isMyTurn = false; // wait for other player
    } else if (gameMode === "single" && player === "X") {
      isMyTurn = false;
      setTimeout(botMove, 500);
    }
  } else {
    isMyTurn = (gameMode === "single") ? (currentPlayer === "X") : true;
  }
}

// ----------------- Render -----------------
function renderBoard() {
  [...boardDiv.children].forEach((cell, i) => {
    const r = Math.floor(i / COLS);
    const c = i % COLS;
    const v = board[r][c];
    if (!v) {
      cell.textContent = "";
      cell.style.color = "";
      cell.style.textShadow = "";
      return;
    }
    let color = v === "X" ? "#fffa00" : "#00fff0";
    if (currentPlayerTheme === "neon") {
      color = v === "X" ? "#ff00ff" : "#00ffff";
      cell.style.textShadow = `0 0 15px ${color}`;
    }
    cell.textContent = v;
    cell.style.color = color;
  });
}

// ----------------- Win Check -----------------
function checkWin(p) {
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c] !== p) continue;
      for (let [dr, dc] of dirs) {
        let count = 0;
        for (let i = 0; i < 4; i++) {
          const nr = r + dr * i;
          const nc = c + dc * i;
          if (board[nr]?.[nc] === p) count++;
        }
        if (count === 4) {
          statusDiv.textContent = `${p} wins!`;
          newGameBtn.style.display = "inline-block";
          points++;
          pointsSpan.textContent = points;
          localStorage.setItem("points", points);
          return true;
        }
      }
    }
  }
  return false;
}

// ----------------- Bot -----------------
function botMove() {
  let validCols = [];
  for (let c = 0; c < COLS; c++) if (board[0][c] === null) validCols.push(c);
  if (validCols.length === 0) return;
  const col = validCols[Math.floor(Math.random() * validCols.length)];
  for (let r = ROWS - 1; r >= 0; r--) {
    if (!board[r][col]) {
      makeMove(r, col, "O", false);
      isMyTurn = true;
      return;
    }
  }
}

// ----------------- Multiplayer -----------------
function setupMultiplayer() {
  document.getElementById("invite").style.display = "block";
  peer = new Peer();
  
  peer.on("open", id => {
    myId = id;
    inviteInput.value = `${window.location.href}?id=${id}`;
  });

  peer.on("connection", c => {
    if (c.peer === myId) { // prevent self-connect
      alert("Cannot connect to yourself!");
      c.close();
      return;
    }
    conn = c;
    setupConnection();
  });

  const params = new URLSearchParams(window.location.search);
  if (params.has("id")) {
    const remoteId = params.get("id");
    if (remoteId !== myId) {
      conn = peer.connect(remoteId);
      setupConnection();
    }
  }

  copyBtn.onclick = () => navigator.clipboard.writeText(inviteInput.value);
}

function setupConnection() {
  conn.on("open", () => {
    // Host (X) starts first
    isMyTurn = true;
    statusDiv.textContent = currentPlayer + "'s move!";
  });

  conn.on("data", d => {
    makeMove(d.r, d.c, d.player, false);
    isMyTurn = true; // allow this player to move
  });
}

// ----------------- Shop UI -----------------
function updateBoardStylesUI() {
  boardStylesDiv.innerHTML = "";
  ["default","dark","neon","gradient"].forEach(s => {
    const b = document.createElement("button");
    b.textContent = s + (boardsOwned.includes(s) ? " (Owned)" : " (5 pts)");
    b.onclick = () => {
      if (!boardsOwned.includes(s)) {
        if (points < 5) return alert("Not enough points");
        points -= 5;
        boardsOwned.push(s);
        localStorage.setItem("points", points);
        localStorage.setItem("boards", JSON.stringify(boardsOwned));
      }
      applyBoardStyle(s);
    };
    boardStylesDiv.appendChild(b);
  });
}

function updatePlayerThemesUI() {
  playerThemesDiv.innerHTML = "";
  ["default","neon"].forEach(t => {
    const b = document.createElement("button");
    b.textContent = t + (playerThemesOwned.includes(t) ? " (Owned)" : " (5 pts)");
    b.onclick = () => {
      if (!playerThemesOwned.includes(t)) {
        if (points < 5) return alert("Not enough points");
        points -= 5;
        playerThemesOwned.push(t);
        localStorage.setItem("points", points);
        localStorage.setItem("playerThemes", JSON.stringify(playerThemesOwned));
      }
      currentPlayerTheme = t;
      localStorage.setItem("currentPlayerTheme", t);
      renderBoard();
    };
    playerThemesDiv.appendChild(b);
  });
}

function applyBoardStyle(s) {
  currentBoardStyle = s;
  localStorage.setItem("currentBoardStyle", s);
  boardDiv.className = s;
}

function resetGame() {
  currentPlayer = "X";
  setupBoard();
  statusDiv.textContent = "Your move!";
  newGameBtn.style.display = "none";
  isMyTurn = true;
}
