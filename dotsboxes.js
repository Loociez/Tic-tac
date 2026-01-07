// ----------------- Global -----------------
const dbBoardDiv = document.getElementById("db-board");
const dbStatus = document.getElementById("db-status");
const dbScores = document.getElementById("db-scores");
const dbNewGameBtn = document.getElementById("db-new-game");
const dbSingleBtn = document.getElementById("db-single");
const dbMultiBtn = document.getElementById("db-multi");
const dbShopBtn = document.getElementById("db-shop-btn");
const dbCloseShopBtn = document.getElementById("db-close-shop");
const dbBoardStylesDiv = document.getElementById("db-board-styles");
const dbLineStylesDiv = document.getElementById("db-line-styles");
const dbInviteLink = document.getElementById("db-invite-link");
const dbHowToBtn = document.getElementById("db-howto-btn");
const dbHowToModal = document.getElementById("db-howto-modal");
const dbCloseHowTo = document.getElementById("db-close-howto");

let dbBoardSize = 4; // 4x4 dots
let dbBoard = [];
let dbLines = {};
let dbBoxes = {};
let dbCurrentPlayer = "You";
let dbScoresData = {You:0, Friend:0, AI:0};
let dbGameMode = null;
let dbIsMyTurn = false;
let dbPeer=null, dbConn=null, dbMyId=null;

// shop data
let points = parseInt(localStorage.getItem("points")) || 0;
let boardStylesOwned = JSON.parse(localStorage.getItem("boards")) || ["default"];
let lineStylesOwned = JSON.parse(localStorage.getItem("playerThemes")) || ["default"];
let currentBoardStyle = localStorage.getItem("currentBoardStyle") || "default";
let currentLineStyle = localStorage.getItem("currentPlayerTheme") || "default";

// ----------------- Utility -----------------
function saveData(){
    localStorage.setItem("points", points);
    localStorage.setItem("boards", JSON.stringify(boardStylesOwned));
    localStorage.setItem("playerThemes", JSON.stringify(lineStylesOwned));
    localStorage.setItem("currentBoardStyle", currentBoardStyle);
    localStorage.setItem("currentPlayerTheme", currentLineStyle);
    updateShopUI();
}

// ----------------- Shop -----------------
dbShopBtn.addEventListener("click",()=>document.getElementById("db-shop").style.display="block");
dbCloseShopBtn.addEventListener("click",()=>document.getElementById("db-shop").style.display="none");

function updateShopUI(){
    dbBoardStylesDiv.innerHTML="";
    ["default","dark","neon","gradient"].forEach(style=>{
        const btn=document.createElement("button");
        btn.textContent=style+(boardStylesOwned.includes(style)?" (Owned)":" (5 pts)");
        btn.addEventListener("click",()=>{
            if(!boardStylesOwned.includes(style)){
                if(points>=5){ points-=5; boardStylesOwned.push(style); applyBoardStyle(style); saveData(); }
                else alert("Not enough points!");
            } else applyBoardStyle(style);
        });
        dbBoardStylesDiv.appendChild(btn);
    });

    dbLineStylesDiv.innerHTML="";
    ["default","neon","fire","ice"].forEach(style=>{
        const btn=document.createElement("button");
        btn.textContent=style+(lineStylesOwned.includes(style)?" (Owned)":" (5 pts)");
        btn.addEventListener("click",()=>{
            if(!lineStylesOwned.includes(style)){
                if(points>=5){ points-=5; lineStylesOwned.push(style); applyLineStyle(style); saveData(); }
                else alert("Not enough points!");
            } else applyLineStyle(style);
        });
        dbLineStylesDiv.appendChild(btn);
    });
}

function applyBoardStyle(style){ 
    currentBoardStyle=style; 
    dbBoardDiv.style.background=style==="dark"?"#222":"#333"; 
}
function applyLineStyle(style){ currentLineStyle=style; }

// ----------------- Game Setup -----------------
dbNewGameBtn.addEventListener("click",()=>startGame(dbGameMode));
dbSingleBtn.addEventListener("click",()=>startGame("single"));
dbMultiBtn.addEventListener("click",()=>startGame("multi"));
dbHowToBtn.addEventListener("click",()=>dbHowToModal.style.display="block");
dbCloseHowTo.addEventListener("click",()=>dbHowToModal.style.display="none");

function startGame(mode){
    dbGameMode=mode;
    dbBoardDiv.innerHTML="";
    dbBoard = Array(dbBoardSize).fill(0).map(()=>Array(dbBoardSize).fill(0));
    dbLines={};
    dbBoxes={};
    dbScoresData={You:0, Friend:0, AI:0};
    dbCurrentPlayer="You";
    dbIsMyTurn = (mode==="single") ? true : true; // always start your turn
    dbStatus.textContent = dbCurrentPlayer+"'s move!";
    setupBoard();
    if(mode==="multi") setupMultiplayer();
}

// ----------------- Board -----------------
function setupBoard(){
    const gap=60;
    const dotSize=16;
    dbBoardDiv.style.width=(dbBoardSize-1)*gap+dotSize+"px";
    dbBoardDiv.style.height=(dbBoardSize-1)*gap+dotSize+"px";

    for(let r=0;r<dbBoardSize;r++){
        for(let c=0;c<dbBoardSize;c++){
            const dot=document.createElement("div");
            dot.classList.add("dot");
            dot.style.left=c*gap+"px";
            dot.style.top=r*gap+"px";
            dbBoardDiv.appendChild(dot);

            if(c<dbBoardSize-1) createLine(r,c,"h",gap,dotSize);
            if(r<dbBoardSize-1) createLine(r,c,"v",gap,dotSize);
        }
    }
    updateScores();
}

function createLine(r,c,dir,gap,dotSize){
    const line=document.createElement("div");
    line.classList.add("line",dir);
    line.dataset.r=r; line.dataset.c=c; line.dataset.dir=dir;

    if(dir==="h"){
        line.style.width=gap-4+"px";
        line.style.height="4px";
        line.style.left=c*gap+dotSize/2+"px";
        line.style.top=r*gap+dotSize/2-2+"px";
    } else {
        line.style.width="4px";
        line.style.height=gap-4+"px";
        line.style.left=c*gap+dotSize/2-2+"px";
        line.style.top=r*gap+dotSize/2+"px";
    }
    line.addEventListener("click",()=>lineClick(line));
    dbBoardDiv.appendChild(line);
    dbLines[`${r},${c},${dir}`]=null;
}

// ----------------- Game Logic -----------------
function lineClick(line){
    const key = `${line.dataset.r},${line.dataset.c},${line.dataset.dir}`;
    if(dbLines[key]!==null) return;
    if(dbGameMode==="multi" && !dbIsMyTurn) return;

    dbLines[key]=dbCurrentPlayer;

    // Set line color based on player
    let lineColor = (dbCurrentPlayer==="You") ? "#0f0" : "#f00";
    if(currentLineStyle==="neon") lineColor = (dbCurrentPlayer==="You") ? "#0f0" : "#ff4444";
    line.style.background = lineColor;
    if(currentLineStyle!=="default") line.style.boxShadow = `0 0 8px ${lineColor}`;

    let gotBox=false;
    const r=parseInt(line.dataset.r), c=parseInt(line.dataset.c);

    const boxesToCheck=[];
    if(line.dataset.dir==="h"){
        if(r>0) boxesToCheck.push([r-1,c]);
        boxesToCheck.push([r,c]);
    } else {
        if(c>0) boxesToCheck.push([r,c-1]);
        boxesToCheck.push([r,c]);
    }

    boxesToCheck.forEach(([br,bc])=>{
        if(br<0 || bc<0 || br>=dbBoardSize-1 || bc>=dbBoardSize-1) return;
        if(dbLines[`${br},${bc},h`] && dbLines[`${br+1},${bc},h`] && dbLines[`${br},${bc},v`] && dbLines[`${br},${bc+1},v`] && !dbBoxes[`${br},${bc}`]){
            dbBoxes[`${br},${bc}`]=dbCurrentPlayer;
            const box=document.createElement("div");
            box.classList.add("box");
            box.style.left=bc*60+16/2+"px";
            box.style.top=br*60+16/2+"px";
            box.textContent=dbCurrentPlayer==="You"?"X":"O";
            box.style.background=(dbCurrentPlayer==="You")?"#0f0":"#f00";
            box.style.boxShadow=`0 0 12px ${(dbCurrentPlayer==="You")?"#0f0":"#f00"}`;
            dbBoardDiv.appendChild(box);
            dbScoresData[dbCurrentPlayer]++;
            gotBox=true;
        }
    });

    updateScores();

    if(!gotBox){
        if(dbGameMode==="single" && dbCurrentPlayer==="You"){ 
            dbCurrentPlayer="AI"; 
            setTimeout(botMove,500); 
        } else if(dbGameMode==="multi") dbIsMyTurn=!dbIsMyTurn;
        else dbCurrentPlayer=(dbCurrentPlayer==="You")?"AI":"You";
    }

    dbStatus.textContent=dbCurrentPlayer+"'s move!";

    if(dbGameMode==="multi" && dbConn){ 
        dbConn.send({type:"line",r,c,dir,player:dbCurrentPlayer}); 
    }

    checkEnd();
}

// ----------------- Bot -----------------
function botMove(){
    const availableLines = Object.keys(dbLines).filter(k=>dbLines[k]===null);
    if(availableLines.length===0) return;
    const chosenKey = availableLines[Math.floor(Math.random()*availableLines.length)];
    const [r,c,dir]=chosenKey.split(",");

    // find the actual DOM element
    const lineEl = Array.from(document.querySelectorAll(".line")).find(l=>l.dataset.r==r && l.dataset.c==c && l.dataset.dir==dir);
    if(lineEl){
        dbCurrentPlayer="AI";
        lineClick(lineEl);
        dbCurrentPlayer="You";
    }
}

// ----------------- Scores -----------------
function updateScores(){
    const opponent = dbGameMode==="single"?"AI":"Friend";
    dbScores.textContent=`Score - You: ${dbScoresData["You"]} | ${opponent}: ${dbScoresData[opponent]||0}`;
}

function checkEnd(){
    if(Object.values(dbLines).every(v=>v!==null)){
        const opponent = dbGameMode==="single"?"AI":"Friend";
        const winner = dbScoresData["You"] > dbScoresData[opponent] ? "You" :
                        dbScoresData["You"] < dbScoresData[opponent] ? "Opponent" : "Draw";
        dbStatus.textContent="Game Over! Winner: "+winner;
    }
}

// ----------------- Multiplayer -----------------
function setupMultiplayer(){
    dbInviteLink.style.display="inline-block";
    dbPeer = new Peer();
    dbPeer.on('open', id => {
        dbMyId=id;
        dbInviteLink.value=window.location.href+"?id="+id;
    });
    dbPeer.on('connection', conn=>{
        dbConn=conn;
        setupConnection();
    });
    const urlParams=new URLSearchParams(window.location.search);
    if(urlParams.has('id')){
        dbConn=dbPeer.connect(urlParams.get('id'));
        setupConnection();
    }
}

function setupConnection(){
    if(!dbConn) return;
    dbConn.on('open', ()=>{ dbIsMyTurn=true; });
    dbConn.on('data', data=>{
        if(data.type==="line"){
            const lineEl = Array.from(document.querySelectorAll(".line")).find(l=>l.dataset.r==data.r && l.dataset.c==data.c && l.dataset.dir==data.dir);
            if(lineEl){
                dbCurrentPlayer="Friend";
                lineClick(lineEl);
                dbCurrentPlayer="You";
            }
            dbIsMyTurn=true;
        }
    });
}

// ----------------- Init -----------------
updateShopUI();
