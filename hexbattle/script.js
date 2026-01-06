// ---------- Shared Economy ----------
let points = parseInt(localStorage.getItem("points")) || 0;
let boardsOwned = JSON.parse(localStorage.getItem("boards")) || ["default"];
let currentBoardStyle = localStorage.getItem("currentBoardStyle") || "default";
let glowStyle = localStorage.getItem("glowStyle") || "soft";

const pointsEl = document.getElementById("points");
const scoreEl = document.getElementById("score");
const statusEl = document.getElementById("status");
pointsEl.textContent = points;

// ---------- Multiplayer ----------
let peer, conn;
let myTurn = true;       // only true when it's your move
let myPlayer = 1;        // 1 or 2

// ---------- Game ----------
const SIZE = 5;
let board = [];
let currentPlayer = 1;
let gameMode = null;

const boardEl = document.getElementById("board");

// ---------- INIT ----------
createBoard();
applyStyles();
buildShop();
updateScore();

// UI
document.getElementById("single").onclick = () => startGame("single");
document.getElementById("multi").onclick = () => startGame("multi");
document.getElementById("new-game").onclick = resetGame;
document.getElementById("how").onclick = () =>
    document.getElementById("rules-modal").style.display = "flex";
document.getElementById("close-rules").onclick = () =>
    document.getElementById("rules-modal").style.display = "none";

// ---------- START ----------
function startGame(mode){
    gameMode = mode;
    document.getElementById("mode-select").style.display = "none";
    resetGame();

    if(mode === "multi") setupMultiplayer();
    if(mode === "single"){
        myPlayer = 1;
        myTurn = true;
        currentPlayer = 1;
        statusEl.textContent = "Your turn";
    }
}

// ---------- BOARD ----------
function createBoard(){
    board = Array(SIZE*SIZE).fill(0);
    boardEl.innerHTML = "";
    for(let i=0;i<board.length;i++){
        const h = document.createElement("div");
        h.className = "hex";
        h.onclick = ()=>move(i);
        boardEl.appendChild(h);
    }
}

// ---------- MOVE ----------
function move(i){
    if(board[i] !== 0) return;
    if(gameMode==="multi" && !myTurn) return;

    board[i] = currentPlayer;
    animate(i);
    capture(i);
    updateScore();

    if(checkEnd()) return;

    if(gameMode === "multi" && conn){
        conn.send({type:"move", index:i});
        myTurn = false;
        statusEl.textContent = "Waiting for opponent...";
    }

    // swap turns
    currentPlayer = currentPlayer === 1 ? 2 : 1;

    // Single player bot
    if(gameMode==="single" && currentPlayer===2){
        myTurn = false;
        statusEl.textContent="Bot's turn...";
        setTimeout(botMove, 500);
    } else if(gameMode==="single"){
        myTurn = true;
        statusEl.textContent="Your turn";
    }
}

// ---------- BOT ----------
function botMove(){
    const open = board.map((v,i)=>v===0?i:null).filter(v=>v!==null);
    if(open.length ===0) return;
    const idx = open[Math.floor(Math.random()*open.length)];
    board[idx]=2;
    animate(idx);
    capture(idx);
    updateScore();
    currentPlayer=1;
    myTurn=true;
    statusEl.textContent="Your turn";
    checkEnd();
}

// ---------- NEIGHBORS ----------
function neighbors(i){
    const x=i%SIZE, y=Math.floor(i/SIZE);
    const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,-1],[-1,1]];
    return dirs.map(d=>[x+d[0],y+d[1]])
        .filter(p=>p[0]>=0&&p[1]>=0&&p[0]<SIZE&&p[1]<SIZE)
        .map(p=>p[1]*SIZE+p[0]);
}

// ---------- CAPTURE ----------
function capture(i){
    const enemy = currentPlayer === 1 ? 2 : 1;
    const adj = neighbors(i).filter(n=>board[n]===enemy);
    if(adj.length >= 3){
        board[adj[0]] = currentPlayer;
        animate(adj[0]);
    }
}

// ---------- SCORE ----------
function score(p){
    let s=0;
    board.forEach((v,i)=>{
        if(v===p){
            const bonus = neighbors(i).filter(n=>board[n]===p).length;
            s += 1 + bonus;
        }
    });
    return s;
}

function updateScore(){
    scoreEl.textContent = `P1: ${score(1)} — P2: ${score(2)}`;
}

// ---------- END ----------
function checkEnd(){
    if(!board.includes(0)){
        const s1 = score(1), s2 = score(2);
        if(s1 > s2){ statusEl.textContent="Player 1 Wins!"; points++; }
        else if(s2 > s1){ statusEl.textContent="Player 2 Wins!"; }
        else statusEl.textContent="Draw!";
        localStorage.setItem("points", points);
        pointsEl.textContent = points;
        return true;
    }
    return false;
}

// ---------- MULTIPLAYER ----------
function setupMultiplayer(){
    document.getElementById("invite").style.display = "block";
    peer = new Peer();

    peer.on("open", id => {
        document.getElementById("invite-link").value =
            `${location.origin}${location.pathname}?id=${id}`;
    });

    peer.on("connection", c=>{
        conn = c;
        myPlayer = 1;
        myTurn = true;
        statusEl.textContent="Your turn";
        setupConn();
    });

    const params = new URLSearchParams(location.search);
    if(params.has("id")){
        conn = peer.connect(params.get("id"));
        myPlayer = 2;
        myTurn = false;
        statusEl.textContent="Waiting for Player 1...";
        setupConn();
    }

    document.getElementById("copy").onclick = ()=>{
        navigator.clipboard.writeText(document.getElementById("invite-link").value);
        alert("Invite link copied!");
    };
}

function setupConn(){
    conn.on("data", data=>{
        if(data.type==="move"){
            board[data.index] = currentPlayer;
            animate(data.index);
            capture(data.index);
            updateScore();
            currentPlayer = currentPlayer === 1 ? 2 : 1;
            myTurn = true;
            statusEl.textContent="Your turn";
            checkEnd();
        }
    });
}

// ---------- VISUAL ----------
function animate(i){
    const h = boardEl.children[i];
    h.classList.add("capture");
    h.classList.toggle("p1", board[i] === 1);
    h.classList.toggle("p2", board[i] === 2);
    setTimeout(()=>h.classList.remove("capture"),300);
}

// ---------- STYLES ----------
function applyStyles(){
    boardEl.className = `board-${currentBoardStyle} glow-${glowStyle}`;
    document.documentElement.style.setProperty("--p1","#22d3ee");
    document.documentElement.style.setProperty("--p2","#f472b6");
}

// ---------- SHOP ----------
function buildShop(){
    const skins=document.getElementById("skins");
    const glows=document.getElementById("glows");

    ["default","ice","ember","void"].forEach(s=>{
        const b=document.createElement("button");
        b.textContent=s+(boardsOwned.includes(s)?" (Owned)":" (5 pts)");
        b.onclick=()=>{
            if(!boardsOwned.includes(s)){
                if(points>=5){points-=5;boardsOwned.push(s);}
                else return alert("Not enough points");
            }
            currentBoardStyle=s;
            save();
        };
        skins.appendChild(b);
    });

    ["none","soft","strong"].forEach(g=>{
        const b=document.createElement("button");
        b.textContent=g;
        b.onclick=()=>{glowStyle=g;save();};
        glows.appendChild(b);
    });
}

function save(){
    localStorage.setItem("points",points);
    localStorage.setItem("boards",JSON.stringify(boardsOwned));
    localStorage.setItem("currentBoardStyle",currentBoardStyle);
    localStorage.setItem("glowStyle",glowStyle);
    pointsEl.textContent=points;
    applyStyles();
}

// ---------- RESET ----------
function resetGame(){
    createBoard();
    currentPlayer = 1;
    myTurn = gameMode==="single" ? true : (myPlayer===1);
    statusEl.textContent = gameMode==="single" ? "Your turn" : (myTurn?"Your turn":"Waiting for opponent...");
    updateScore();
}
