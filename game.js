const GRID_SIZE = 5;
const gridElement = document.getElementById('game-grid');
const scoreElement = document.getElementById('score');
const bestScoreDisplay = document.getElementById('best-score-val');
const canvas = document.getElementById('connection-canvas');

let grid = [];
let score = 0;
let bestScore = parseInt(localStorage.getItem('materialConnectBest')) || 0;
let selectedPath = [];
let isDragging = false;

bestScoreDisplay.innerText = bestScore;

function createWaveTitle() {
    const titleContainer = document.getElementById('wave-title');
    const text = "Material";
    titleContainer.innerHTML = "";
    text.split("").forEach((char, i) => {
        const span = document.createElement("span");
        span.innerText = char;
        span.style.animationDelay = `${i * 0.1}s`;
        titleContainer.appendChild(span);
    });
}

function updateBestScore() {
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('materialConnectBest', bestScore);
        bestScoreDisplay.innerText = bestScore;
        return true;
    }
    return false;
}

function goToGame() {
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    resetGame();
}

function goToMenu() {
    document.getElementById('game-screen').classList.add('hidden');
    document.getElementById('menu-screen').classList.remove('hidden');
    document.getElementById('game-over-overlay').style.display = 'none';
}

function initGrid() {
    gridElement.innerHTML = '';
    grid = [];
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
        const value = Math.pow(2, Math.floor(Math.random() * 3) + 1);
        grid.push(value);
        const cell = document.createElement('div');
        cell.className = `cell val-${value}`;
        cell.dataset.index = i;
        cell.innerText = value;

        cell.addEventListener('mousedown', startSelection);
        cell.addEventListener('mouseenter', handleMove);

        cell.addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            startSelection(e); 
        }, {passive: false});
        cell.addEventListener('touchmove', handleTouchMove, {passive: false});

        gridElement.appendChild(cell);
    }
    setTimeout(updateCanvasSize, 150);
}

function updateCanvasSize() {
    const rect = gridElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}

function getPointFromEvent(e) {
    if (e.touches && e.touches.length > 0) {
        return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
}

function startSelection(e) {
    isDragging = true;
    const pt = getPointFromEvent(e);
    const target = document.elementFromPoint(pt.x, pt.y);
    const index = parseInt(target?.dataset?.index);
    if (!isNaN(index)) addToPath(index);
}

function handleTouchMove(e) {
    if (!isDragging) return;
    const pt = getPointFromEvent(e);
    const target = document.elementFromPoint(pt.x, pt.y);
    if (target && target.classList.contains('cell')) {
        handleMove({ target: target });
    }
}

function handleMove(e) {
    if (!isDragging) return;
    const index = parseInt(e.target.dataset.index);
    if (isNaN(index)) return;

    const lastIndex = selectedPath[selectedPath.length - 1];
    if (index === lastIndex) return;

    if (selectedPath.length > 1 && index === selectedPath[selectedPath.length - 2]) {
        const removed = selectedPath.pop();
        document.querySelector(`[data-index="${removed}"]`).classList.remove('selected');
        drawLines();
        return;
    }

    if (grid[index] === grid[lastIndex] && isAdjacent(index, lastIndex) && !selectedPath.includes(index)) {
        addToPath(index);
        if (window.navigator.vibrate) window.navigator.vibrate(10);
    }
}

function isAdjacent(idx1, idx2) {
    const x1 = idx1 % GRID_SIZE, y1 = Math.floor(idx1 / GRID_SIZE);
    const x2 = idx2 % GRID_SIZE, y2 = Math.floor(idx2 / GRID_SIZE);
    return Math.abs(x1 - x2) <= 1 && Math.abs(y1 - y2) <= 1;
}

function addToPath(index) {
    selectedPath.push(index);
    document.querySelector(`[data-index="${index}"]`).classList.add('selected');
    drawLines();
}

function drawLines() {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (selectedPath.length < 2) return;

    const baseColor = getComputedStyle(document.querySelector(`[data-index="${selectedPath[0]}"]`)).backgroundColor;
    ctx.beginPath();
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = baseColor;
    ctx.globalAlpha = 0.5;

    const gridRect = gridElement.getBoundingClientRect();

    selectedPath.forEach((idx, i) => {
        const cell = document.querySelector(`[data-index="${idx}"]`);
        const rect = cell.getBoundingClientRect();
        const x = rect.left - gridRect.left + rect.width / 2;
        const y = rect.top - gridRect.top + rect.height / 2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
}

function endSelection() {
    if (!isDragging) return;
    isDragging = false;
    if (selectedPath.length >= 2) processSelection();
    selectedPath.forEach(idx => {
        const cell = document.querySelector(`[data-index="${idx}"]`);
        if (cell) cell.classList.remove('selected');
    });
    selectedPath = [];
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

function processSelection() {
    const baseValue = grid[selectedPath[0]];
    const totalValue = baseValue * selectedPath.length;
    let newValue = 2;
    while (newValue < totalValue) newValue *= 2;

    score += totalValue;
    scoreElement.innerText = score;
    updateBestScore();

    selectedPath.forEach((idx, i) => {
        grid[idx] = (i === selectedPath.length - 1) ? newValue : null;
    });
    applyGravity();
    updateGridDisplay();
    if (checkGameOver()) showGameOver();
}

function applyGravity() {
    for (let x = 0; x < GRID_SIZE; x++) {
        let column = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            const val = grid[y * GRID_SIZE + x];
            if (val !== null) column.push(val);
        }
        while (column.length < GRID_SIZE) column.unshift(Math.pow(2, Math.floor(Math.random() * 3) + 1));
        for (let y = 0; y < GRID_SIZE; y++) grid[y * GRID_SIZE + x] = column[y];
    }
}

function updateGridDisplay() {
    grid.forEach((value, i) => {
        const cell = document.querySelector(`[data-index="${i}"]`);
        cell.innerText = value;
        cell.className = `cell val-${value}`;
    });
}

function checkGameOver() {
    for (let i = 0; i < grid.length; i++) {
        const x = i % GRID_SIZE, y = Math.floor(i / GRID_SIZE);
        const check = [[x + 1, y], [x, y + 1], [x + 1, y + 1], [x - 1, y + 1]];
        for (let [nx, ny] of check) {
            if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                if (grid[i] === grid[ny * GRID_SIZE + nx]) return false;
            }
        }
    }
    return true;
}

function showGameOver() {
    const isNewRecord = updateBestScore();
    document.getElementById('game-over-title').innerText = isNewRecord ? "Nuovo Record!" : "Fine Partita";
    document.getElementById('trophy-icon').innerText = isNewRecord ? "⭐" : "🏆";
    document.getElementById('final-score-text').innerText = `Hai totalizzato ${score} punti!`;
    document.getElementById('game-over-overlay').style.display = 'flex';
}

function resetGame() {
    score = 0;
    scoreElement.innerText = score;
    document.getElementById('game-over-overlay').style.display = 'none';
    initGrid();
}

window.addEventListener('mouseup', endSelection);
window.addEventListener('touchend', endSelection);
window.addEventListener('resize', () => {
    updateCanvasSize();
    drawLines();
});

window.onload = () => {
    createWaveTitle();
    initGrid();
};
