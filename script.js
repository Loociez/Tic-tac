// ----------------- Global Variables -----------------
let board = [];
let currentPlayer = 'X';
let lastMove = null;
let gameMode = null; 
let isMyTurn = false;

let points = parseInt(localStorage.getItem("points")) || 0;
let boardsOwned = JSON.parse(localStorage.getItem("boards")) || ["default"];
let currentBoardStyle = localStorage.getItem("currentBoardStyle") || "default";
let playerThemesOwned = JSON.parse(localStorage.getItem("playerThemes")) || ["default"];
let currentPlayerTheme = localStorage.getItem("currentPlayerTheme") || "default";

let streak = parseInt(localStorage.getItem("streak")) || 0;
let achievements = JSON.parse(localStorage.getItem("achievements")) || [];

let peer, conn, myId = null;

const boardDiv = document.getElementById('board');
const statusDiv = document.getElementById('status');
const newGameBtn = document.getElementById('new-game');
const inviteInput = document.getElementById('invite-link');
const copyBtn = document.getElementById('copy-link');
const singleBtn = document.getElementById('single-player');
const multiBtn = document.getElementById('multi-player');
const modeDiv = document.getElementById('mode-selection');
const shopDiv = document.getElementById('shop');
const shopBtn = document.getElementById('shop-btn');
const closeShopBtn = document.getElementById('close-shop');
const pointsSpan = document.getElementById('points');
const boardStylesDiv = document.getElementById('board-styles');
const playerThemesDiv = document.getElementById('player-themes');
const chatDiv = document.getElementById('chat');
const chatInput = document.getElementById('chat-input');
const chatSendBtn = document.getElementById('chat-send');
const confettiCanvas = document.getElementById('confetti');
const confettiCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];
let victoryParticles = [];

// ----------------- Utility -----------------
function saveData() {
    localStorage.setItem("points", points);
    localStorage.setItem("boards", JSON.stringify(boardsOwned));
    localStorage.setItem("currentBoardStyle", currentBoardStyle);
    localStorage.setItem("playerThemes", JSON.stringify(playerThemesOwned));
    localStorage.setItem("currentPlayerTheme", currentPlayerTheme);
    localStorage.setItem("streak", streak);
    localStorage.setItem("achievements", JSON.stringify(achievements));
    updateBoardStylesUI();
    updatePlayerThemesUI();
    pointsSpan.textContent = points;
}

// ----------------- Shop -----------------
shopBtn.addEventListener("click", () => shopDiv.style.display = "block");
closeShopBtn.addEventListener("click", () => shopDiv.style.display = "none");

// ----------------- Board & Theme UI -----------------
function updateBoardStylesUI(){
    boardStylesDiv.innerHTML = "";
    const allStyles = [
        "default",
        "dark",
        "neon",
        "gradient",
        "calm-blue",      // New style 1
        "sunset-orange",  // New style 2
        "forest-green",   // New style 3
        "steel-gray"      // New style 4
    ];
    allStyles.forEach(style => {
        const btn = document.createElement("button");
        btn.textContent = style + (boardsOwned.includes(style)?" (Owned)":" (5 pts)");
        btn.addEventListener("click", () => {
            if(!boardsOwned.includes(style)){
                if(points >= 5){ 
                    points -= 5; 
                    boardsOwned.push(style); 
                    applyBoardStyle(style); 
                    saveData(); 
                } else alert("Not enough points!");
            } else applyBoardStyle(style);
        });
        boardStylesDiv.appendChild(btn);
    });
}

function updatePlayerThemesUI(){
    playerThemesDiv.innerHTML = "";
    const allThemes = [
        {id:"default",label:"Default (X yellow / O cyan)"},
        {id:"neon",label:"Neon (X pink / O teal)"},
        {id:"fire",label:"Fire (X orange / O red)"},
        {id:"ice",label:"Ice (X lightblue / O darkblue)"},
        {id:"snow",label:"Snow Theme (X white / O blue)"},
        {id:"embers",label:"Embers Theme (X red / O orange)"}
    ];
    allThemes.forEach(theme => {
        const btn = document.createElement("button");
        btn.textContent = theme.label + (playerThemesOwned.includes(theme.id)?" (Owned)":" (5 pts)");
        btn.addEventListener("click", () => {
            if(!playerThemesOwned.includes(theme.id)){
                if(points >=5){ points -=5; playerThemesOwned.push(theme.id); equipPlayerTheme(theme.id); saveData(); }
                else alert("Not enough points!");
            } else equipPlayerTheme(theme.id);
        });
        playerThemesDiv.appendChild(btn);
    });
}

function applyBoardStyle(style){
    currentBoardStyle = style;
    boardDiv.className = "";
    boardDiv.classList.add(style);
    saveData();
}

function equipPlayerTheme(themeId){
    currentPlayerTheme = themeId;
    saveData();
    updateBoard();
}

// ----------------- Start Game -----------------
singleBtn.addEventListener("click", ()=>startGame("single"));
multiBtn.addEventListener("click", ()=>startGame("multi"));
newGameBtn.addEventListener("click", resetGame);

function startGame(mode){
    gameMode = mode;
    modeDiv.style.display="none";
    boardDiv.style.display="grid";
    boardDiv.style.gridTemplateColumns="repeat(3,100px)";
    setupBoard();
    applyBoardStyle(currentBoardStyle);
    updateBoard();
    pointsSpan.textContent = points;
    if(mode === "single"){ isMyTurn = true; statusDiv.textContent="Your move!"; }
    if(mode === "multi") setupMultiplayer();
}

// ----------------- Board & Moves -----------------
function setupBoard(){
    board = Array(9).fill(null);
    lastMove = null;
    boardDiv.innerHTML = "";
    for(let i = 0; i < 9; i++){
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        cell.style.width = "100px";
        cell.style.height = "100px";
        cell.addEventListener('click', ()=>cellClick(i));
        boardDiv.appendChild(cell);
    }
}

function cellClick(i){
    if(board[i]!==null || !isMyTurn) return;
    makeMove(i,currentPlayer,true);
    if(gameMode==="single"){ isMyTurn=false; setTimeout(botMove,500); }
}

function makeMove(i,player,send){
    board[i] = player;
    lastMove = i;
    updateBoard();
    if(checkWinner()) return;
    currentPlayer = player==="X"?"O":"X";
    if(send && gameMode==="multi" && conn){ conn.send({type:"move",index:i,player}); isMyTurn=false; }
}

function updateBoard(){
    board.forEach((v,i)=>{
        const cell = boardDiv.children[i];
        cell.textContent = v?v:"";
        cell.classList.remove('x','o','flash');
        if(v){
            let color="", shadow="";
            switch(currentPlayerTheme){
                case "default": color=v==="X"?"#fffa00":"#00fff0"; shadow=""; break;
                case "neon": color=v==="X"?"#ff00ff":"#00ffff"; shadow="0 0 20px "+color; break;
                case "fire": color=v==="X"?"orange":"red"; shadow="0 0 15px "+color; break;
                case "ice": color=v==="X"?"lightblue":"darkblue"; shadow="0 0 15px "+color; break;
                case "snow": color=v==="X"?"#ffffff":"#00bfff"; shadow="0 0 10px "+color; break;
                case "embers": color=v==="X"?"#ff3300":"#ff9933"; shadow="0 0 15px "+color; break;
                default: color=v==="X"?"#fffa00":"#00fff0"; shadow=""; break;
            }
            cell.style.color = color;
            cell.style.textShadow = shadow;
            cell.classList.add(v.toLowerCase());
        } else { cell.style.color=""; cell.style.textShadow=""; }
    });
}

// ----------------- Check Winner & Streaks -----------------
function checkWinner(){
    const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const c of combos){
        const [a,b,d] = c;
        if(board[a] && board[a]===board[b] && board[a]===board[d]){
            statusDiv.textContent = `${board[a]} wins!`;
            highlightWin(c);
            triggerVictoryEffect(currentPlayerTheme);
            newGameBtn.style.display = "inline-block";
            points++;
            streak++;
            checkAchievements();
            saveData(); 
            return true;
        }
    }
    if(!board.includes(null)){
        statusDiv.textContent = "It's a draw!";
        newGameBtn.style.display = "inline-block";
        streak = 0;
        saveData();
        return true;
    }
    return false;
}

function highlightWin(combo){ combo.forEach(i => boardDiv.children[i].classList.add('flash')); }

function checkAchievements(){
    if(streak>=3 && !achievements.includes("3-win streak")){
        achievements.push("3-win streak");
        alert("Achievement unlocked: 3-win streak!");
        points += 3;
    }
    if(streak>=5 && !achievements.includes("5-win streak")){
        achievements.push("5-win streak");
        alert("Achievement unlocked: 5-win streak!");
        points += 5;
    }
}

// ----------------- Bot -----------------
function botMove(){
    if(checkWinner()) return;
    const move = findBestMove('O') || findBestMove('X') || randomMove();
    makeMove(move,'O',false);
    isMyTurn=true;
}
function findBestMove(player){
    const combos = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for(const c of combos){
        const vals = c.map(i=>board[i]);
        if(vals.filter(v=>v===player).length===2 && vals.includes(null)) return c[vals.indexOf(null)];
    }
    return null;
}
function randomMove(){
    const empty = board.map((v,i)=>v===null?i:null).filter(v=>v!==null);
    return empty[Math.floor(Math.random()*empty.length)];
}

// ----------------- Reset Game -----------------
function resetGame(){
    newGameBtn.style.display = "none";
    statusDiv.textContent = "Your move!";
    currentPlayer = 'X';
    setupBoard();
    isMyTurn = gameMode==='single'?true:false;
    pointsSpan.textContent = points;
}

// ----------------- Multiplayer -----------------
function setupMultiplayer(){
    document.getElementById('invite').style.display = "block";
    peer = new Peer();
    peer.on('open', id => { myId = id; inviteInput.value = `${window.location.href}?id=${id}`; });
    peer.on('connection', connection => { conn = connection; setupConnection(); });
    copyBtn.addEventListener('click', ()=>{ navigator.clipboard.writeText(inviteInput.value); alert("Link copied!"); });
    const urlParams = new URLSearchParams(window.location.search);
    if(urlParams.has('id')){ const remoteId = urlParams.get('id'); conn = peer.connect(remoteId); setupConnection(); }
}

// ----------------- Chat -----------------
chatSendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', function(e){
    if(e.key === 'Enter'){ sendMessage(); e.preventDefault(); }
});

function sendMessage(){
    const msg = chatInput.value.trim();
    if(!msg) return;
    addChatMessage("You: " + msg);
    if(conn) conn.send({type:"chat", message: msg});
    chatInput.value = "";
}

function setupConnection(){
    conn.on('open', ()=>{ statusDiv.textContent = "Connected! Your move if you're X."; isMyTurn = true; });
    conn.on('data', data => {
        if(data.type==='move'){ makeMove(data.index,data.player,false); isMyTurn=true; }
        if(data.type==='chat'){ addChatMessage("Friend: "+data.message); }
    });
}

function addChatMessage(msg){
    const p = document.createElement('p');
    p.textContent = msg;
    chatDiv.appendChild(p);
    chatDiv.scrollTop = chatDiv.scrollHeight;
}

// ----------------- Victory Effects -----------------
function triggerVictoryEffect(theme){
    victoryParticles=[];
    let count = 150;
    for(let i=0;i<count;i++){
        let color;
        let x = Math.random()*window.innerWidth;
        let y = -10;
        let r = Math.random()*4+2;
        let d = Math.random()*20+10;
        let tilt = Math.random()*10-10;
        let tiltAngle = 0;
        let tiltInc = Math.random()*0.07+0.05;
        switch(theme){
            case "snow": color = "#ffffff"; y = Math.random()*-50; break;
            case "embers": color = "#ff3300"; break;
            case "fire": color = "orange"; break;
            case "ice": color = "#00ffff"; break;
            default: color = `hsl(${Math.random()*360},100%,50%)`; break;
        }
        victoryParticles.push({x,y,r,d,color,tilt,tiltAngle,tiltAngleIncremental:tiltInc});
    }
    requestAnimationFrame(drawVictoryParticles);
}

function drawVictoryParticles(){
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
    for(let p of victoryParticles){
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += theme=="snow"?1+p.r/2:(Math.cos(p.d)+3+p.r/2)/2;
        p.x += Math.sin(p.d);
        p.tilt = Math.sin(p.tiltAngle)*15;
        confettiCtx.beginPath();
        confettiCtx.lineWidth = p.r/2;
        confettiCtx.strokeStyle = p.color;
        confettiCtx.moveTo(p.x+p.tilt+p.r/4,p.y);
        confettiCtx.lineTo(p.x+p.tilt,p.y+p.tilt+p.r/4);
        confettiCtx.stroke();
    }
    victoryParticles = victoryParticles.filter(p=>p.y<window.innerHeight+10);
    if(victoryParticles.length>0) requestAnimationFrame(drawVictoryParticles);
}

// ----------------- Confetti -----------------
function triggerConfetti(){
    confettiParticles=[];
    for(let i=0;i<150;i++){
        confettiParticles.push({x:Math.random()*window.innerWidth,y:Math.random()*window.innerHeight,r:Math.random()*6+4,d:Math.random()*20+10,color:`hsl(${Math.random()*360},100%,50%)`,tilt:Math.random()*10-10,tiltAngleIncremental:Math.random()*0.07+0.05,tiltAngle:0});
    }
    requestAnimationFrame(drawConfetti);
}
function drawConfetti(){
    confettiCanvas.width = window.innerWidth;
    confettiCanvas.height = window.innerHeight;
    confettiCtx.clearRect(0,0,window.innerWidth,window.innerHeight);
    for(let p of confettiParticles){
        p.tiltAngle += p.tiltAngleIncremental;
        p.y += (Math.cos(p.d)+3+p.r/2)/2;
        p.x += Math.sin(p.d);
        p.tilt = Math.sin(p.tiltAngle)*15;
        confettiCtx.beginPath();
        confettiCtx.lineWidth = p.r/2;
        confettiCtx.strokeStyle = p.color;
        confettiCtx.moveTo(p.x+p.tilt+p.r/4,p.y);
        confettiCtx.lineTo(p.x+p.tilt,p.y+p.tilt+p.r/4);
        confettiCtx.stroke();
    }
    confettiParticles = confettiParticles.filter(p=>p.y<window.innerHeight);
    if(confettiParticles.length>0) requestAnimationFrame(drawConfetti);
}

// ----------------- Initialize -----------------
pointsSpan.textContent = points;
updateBoardStylesUI();
updatePlayerThemesUI();
applyBoardStyle(currentBoardStyle);
