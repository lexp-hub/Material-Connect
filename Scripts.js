import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- FIREBASE CONFIG ---
const firebaseConfig = JSON.parse(window.__firebase_config || '{}');
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'material-connect-git';

let user = null;
let highscore = parseInt(localStorage.getItem('mc_highscore')) || 0;
document.getElementById('best-score-val').innerText = highscore;

// --- AUTH ---
const initAuth = async () => {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
        } else {
            await signInAnonymously(auth);
        }
    } catch(e) { console.warn("Firebase Auth offline"); }
};
initAuth();

onAuthStateChanged(auth, (u) => {
    if (u) {
        user = u;
        document.getElementById('user-info').innerText = `ID: ${u.uid.substring(0,6)}`;
        const recordDoc = doc(db, 'artifacts', appId, 'users', u.uid, 'stats', 'game');
        onSnapshot(recordDoc, (snap) => {
            if (snap.exists()) {
                const cloudScore = snap.data().bestScore || 0;
                if (cloudScore > highscore) {
                    highscore = cloudScore;
                    localStorage.setItem('mc_highscore', highscore);
                    document.getElementById('best-score-val').innerText = highscore;
                }
            }
        });
    }
});

// --- RADIO LOGIC ---
let player;
window.onYouTubeIframeAPIReady = () => {
    player = new YT.Player('player', {
        height: '100%', width: '100%', videoId: 'n61ULEU7CO0',
        playerVars: { 'autoplay': 0, 'controls': 1, 'modestbranding': 1, 'rel': 0 },
    });
};

window.openMusicPanel = () => {
    document.getElementById('music-panel').classList.add('open');
    document.getElementById('music-overlay').classList.add('visible');
};

window.closeMusicPanel = () => {
    document.getElementById('music-panel').classList.remove('open');
    document.getElementById('music-overlay').classList.remove('visible');
};

window.loadVideo = () => {
    let input = document.getElementById('yt-url').value;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = input.match(regExp);
    if(match && match[2].length == 11) player.loadVideoById(match[2]);
};

// --- GAME LOGIC ---
const gridElement = document.getElementById('game-grid');
const scoreElement = document.getElementById('score');
const canvas = document.getElementById('connection-canvas');
let grid = [], score = 0, selectedPath = [], isDragging = false;

function initGrid() {
    gridElement.innerHTML = ''; grid = []; score = 0; scoreElement.innerText = "0";
    for (let i = 0; i < 25; i++) {
        const val = Math.pow(2, Math.floor(Math.random() * 3) + 1);
        grid.push(val);
        const cell = document.createElement('div');
        cell.className = `cell val-${val}`;
        cell.dataset.index = i;
        cell.innerText = val;
        cell.addEventListener('pointerdown', startSelection);
        cell.addEventListener('pointerenter', handleMove);
        gridElement.appendChild(cell);
    }
    setTimeout(updateCanvasSize, 50);
}

function startSelection(e) {
    isDragging = true;
    const index = parseInt(e.target.dataset.index);
    if (!isNaN(index)) {
        e.target.releasePointerCapture(e.pointerId);
        addToPath(index);
    }
}

window.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target && target.classList.contains('cell')) {
        handleMove({ target });
    }
});

function handleMove(e) {
    if (!isDragging) return;
    const index = parseInt(e.target.dataset.index);
    if (isNaN(index)) return;
    const last = selectedPath[selectedPath.length - 1];
    if (index === last) return;
    
    if (selectedPath.length > 1 && index === selectedPath[selectedPath.length - 2]) {
        const removed = selectedPath.pop();
        document.querySelector(`[data-index="${removed}"]`).classList.remove('selected');
        drawLines(); return;
    }

    if (grid[index] === grid[last] && isAdj(index, last) && !selectedPath.includes(index)) {
        addToPath(index);
        if (window.navigator.vibrate) window.navigator.vibrate(5);
    }
}

function isAdj(i1, i2) {
    const x1 = i1 % 5, y1 = Math.floor(i1 / 5);
    const x2 = i2 % 5, y2 = Math.floor(i2 / 5);
    return Math.abs(x1 - x2) <= 1 && Math.abs(y1 - y2) <= 1;
}

function addToPath(i) {
    selectedPath.push(i);
    document.querySelector(`[data-index="${i}"]`).classList.add('selected');
    drawLines();
}

function drawLines() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (selectedPath.length < 2) return;
    const r = gridElement.getBoundingClientRect();
    ctx.beginPath(); ctx.lineWidth = 14; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = getComputedStyle(document.querySelector(`[data-index="${selectedPath[0]}"]`)).backgroundColor;
    ctx.globalAlpha = 0.5;
    selectedPath.forEach((idx, i) => {
        const cr = document.querySelector(`[data-index="${idx}"]`).getBoundingClientRect();
        const x = cr.left - r.left + cr.width/2;
        const y = cr.top - r.top + cr.height/2;
        if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();
}

function endSelection() {
    if (!isDragging) return; isDragging = false;
    if (selectedPath.length >= 2) {
        const total = grid[selectedPath[0]] * selectedPath.length;
        let nv = 2; while (nv < total) nv *= 2;
        score += total; scoreElement.innerText = score;
        saveScore(score);

        selectedPath.forEach((idx, i) => grid[idx] = (i === selectedPath.length-1) ? nv : null);
        
        for (let x=0; x<5; x++) {
            let col = []; for (let y=0; y<5; y++) if(grid[y*5+x]!==null) col.push(grid[y*5+x]);
            while(col.length<5) col.unshift(Math.pow(2, Math.floor(Math.random()*3)+1));
            for (let y=0; y<5; y++) grid[y*5+x] = col[y];
        }
        
        grid.forEach((v, i) => { 
            const cell = document.querySelector(`[data-index="${i}"]`);
            cell.innerText = v; cell.className = `cell val-${v}`;
        });
    }
    selectedPath.forEach(i => document.querySelector(`[data-index="${i}"]`)?.classList.remove('selected'));
    selectedPath = []; drawLines();
}

async function saveScore(newScore) {
    if (newScore <= highscore) return;
    highscore = newScore;
    localStorage.setItem('mc_highscore', highscore);
    document.getElementById('best-score-val').innerText = highscore;
    if (!user) return;
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'stats', 'game'), {
        bestScore: newScore, updatedAt: new Date()
    }, { merge: true });
}

function updateCanvasSize() {
    const r = gridElement.getBoundingClientRect();
    if(r.width > 0) { canvas.width = r.width; canvas.height = r.height; }
}

window.goToGame = () => {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    initGrid();
};

window.goToMenu = () => {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.remove('hidden');
};

window.addEventListener('pointerup', endSelection);
window.addEventListener('resize', updateCanvasSize);
window.addEventListener('load', () => {
    const t = "Material"; const tc = document.getElementById('wave-title');
    t.split("").forEach((c, i) => {
        const s = document.createElement("span"); s.innerText=c; s.style.animationDelay=`${i*0.08}s`; tc.appendChild(s);
    });
});
