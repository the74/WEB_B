
// ==========================================================================
// ТЕТРИС
// ==========================================================================

// Константы
const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const CELL_SIZE = 30;

// Фигуры
const SHAPES = [
    {   // I
        matrix: [[1,1,1,1]],
        color: '#00e5f0'
    },
    {   // O
        matrix: [[1,1],[1,1]],
        color: '#f0e500'
    },
    {   // T
        matrix: [[0,1,0],[1,1,1]],
        color: '#c084fc'
    },
    {   // S
        matrix: [[0,1,1],[1,1,0]],
        color: '#10b981'
    },
    {   // Z
        matrix: [[1,1,0],[0,1,1]],
        color: '#ef4444'
    },
    {   // L
        matrix: [[1,0,0],[1,1,1]],
        color: '#f97316'
    },
    {   // J
        matrix: [[0,0,1],[1,1,1]],
        color: '#3b82f6'
    }
];

// DOM элементы
const canvas = document.getElementById('tetris-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreElement = document.getElementById('score');
const linesElement = document.getElementById('lines');
const levelElement = document.getElementById('level');
const highScoreElement = document.getElementById('high-score');
const personalBestElement = document.getElementById('personal-best');
const gameStatus = document.getElementById('game-status');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const backBtn = document.getElementById('back-btn');

// Настройка размеров canvas
canvas.width = BOARD_WIDTH * CELL_SIZE;
canvas.height = BOARD_HEIGHT * CELL_SIZE;
nextCanvas.width = 120;
nextCanvas.height = 120;

// Игровые переменные
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let highScore = localStorage.getItem('tetris_high_score') || 0;
let personalBest = 0;
let gameRunning = false;
let gamePaused = false;
let gameLoop = null;
let fallInterval = 500;

// Пользователь
let currentUserEmail = null;

// Класс фигуры
class Piece {
    constructor(shape, x, y) {
        this.matrix = shape.matrix.map(row => [...row]);
        this.color = shape.color;
        this.x = x;
        this.y = y;
    }
    
    rotate() {
        const rotated = this.matrix[0].map((_, i) => this.matrix.map(row => row[i]).reverse());
        return rotated;
    }
}

// ==========================================================================
// РАБОТА С ПОЛЬЗОВАТЕЛЕМ И РЕКОРДАМИ
// ==========================================================================

function getCurrentUser() {
    const activeEmail = localStorage.getItem('active_session_email');
    if (activeEmail) {
        const userData = JSON.parse(localStorage.getItem('cached_profile'));
        if (userData) {
            currentUserEmail = activeEmail;
            return true;
        }
    }
    return false;
}

async function loadUserBestScore() {
    if (!currentUserEmail) return;
    
    try {
        const response = await fetch(`/api.php?action=get_tetris_score&email=${currentUserEmail}`);
        const result = await response.json();
        
        if (result.success) {
            personalBest = result.score;
            if (personalBestElement) personalBestElement.textContent = personalBest;
        }
    } catch (error) {
        console.error('Error loading score:', error);
    }
}

async function saveScoreToServer(finalScore, finalLevel, finalLines) {
    if (!currentUserEmail) return;
    if (finalScore <= personalBest) return;
    
    try {
        const response = await fetch('/api.php?action=save_tetris_score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: currentUserEmail,
                score: finalScore,
                level: finalLevel,
                lines: finalLines
            })
        });
        const result = await response.json();
        
        if (result.success && result.new_record) {
            personalBest = finalScore;
            if (personalBestElement) personalBestElement.textContent = personalBest;
            showToast(' НОВЫЙ РЕКОРД! ');
        }
    } catch (error) {
        console.error('Error saving score:', error);
    }
}

// ==========================================================================
// ИГРОВАЯ ЛОГИКА
// ==========================================================================

// Инициализация рекорда
highScoreElement.textContent = highScore;

// Отрисовка сетки
function drawGrid() {
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 0.5;
    
    for (let row = 0; row <= BOARD_HEIGHT; row++) {
        ctx.beginPath();
        ctx.moveTo(0, row * CELL_SIZE);
        ctx.lineTo(BOARD_WIDTH * CELL_SIZE, row * CELL_SIZE);
        ctx.stroke();
    }
    
    for (let col = 0; col <= BOARD_WIDTH; col++) {
        ctx.beginPath();
        ctx.moveTo(col * CELL_SIZE, 0);
        ctx.lineTo(col * CELL_SIZE, BOARD_HEIGHT * CELL_SIZE);
        ctx.stroke();
    }
}

// Отрисовка доски
function drawBoard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    for (let row = 0; row < BOARD_HEIGHT; row++) {
        for (let col = 0; col < BOARD_WIDTH; col++) {
            if (board[row][col]) {
                ctx.fillStyle = board[row][col];
                ctx.fillRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
                ctx.strokeStyle = '#fff';
                ctx.strokeRect(col * CELL_SIZE, row * CELL_SIZE, CELL_SIZE - 1, CELL_SIZE - 1);
            }
        }
    }
    
    if (currentPiece) {
        for (let row = 0; row < currentPiece.matrix.length; row++) {
            for (let col = 0; col < currentPiece.matrix[row].length; col++) {
                if (currentPiece.matrix[row][col]) {
                    const x = (currentPiece.x + col) * CELL_SIZE;
                    const y = (currentPiece.y + row) * CELL_SIZE;
                    ctx.fillStyle = currentPiece.color;
                    ctx.fillRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
                    ctx.strokeStyle = '#fff';
                    ctx.strokeRect(x, y, CELL_SIZE - 1, CELL_SIZE - 1);
                }
            }
        }
    }
    
    drawGrid();
}

// Отрисовка следующей фигуры
function drawNext() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    nextCtx.fillStyle = '#0a0a1a';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (nextPiece) {
        const pieceWidth = nextPiece.matrix[0].length * 30;
        const pieceHeight = nextPiece.matrix.length * 30;
        const offsetX = (nextCanvas.width - pieceWidth) / 2;
        const offsetY = (nextCanvas.height - pieceHeight) / 2;
        
        for (let row = 0; row < nextPiece.matrix.length; row++) {
            for (let col = 0; col < nextPiece.matrix[row].length; col++) {
                if (nextPiece.matrix[row][col]) {
                    nextCtx.fillStyle = nextPiece.color;
                    nextCtx.fillRect(offsetX + col * 30, offsetY + row * 30, 29, 29);
                    nextCtx.strokeStyle = '#fff';
                    nextCtx.strokeRect(offsetX + col * 30, offsetY + row * 30, 29, 29);
                }
            }
        }
    }
}

// Генерация случайной фигуры
function getRandomPiece() {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    return new Piece(shape, Math.floor((BOARD_WIDTH - shape.matrix[0].length) / 2), 0);
}

// Проверка коллизии
function checkCollision(piece, newX, newY) {
    for (let row = 0; row < piece.matrix.length; row++) {
        for (let col = 0; col < piece.matrix[row].length; col++) {
            if (piece.matrix[row][col]) {
                const boardX = newX + col;
                const boardY = newY + row;
                
                if (boardX < 0 || boardX >= BOARD_WIDTH || boardY >= BOARD_HEIGHT || boardY < 0) {
                    return true;
                }
                
                if (boardY >= 0 && board[boardY][boardX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Закрепление фигуры
function mergePiece() {
    for (let row = 0; row < currentPiece.matrix.length; row++) {
        for (let col = 0; col < currentPiece.matrix[row].length; col++) {
            if (currentPiece.matrix[row][col]) {
                const boardX = currentPiece.x + col;
                const boardY = currentPiece.y + row;
                if (boardY >= 0) {
                    board[boardY][boardX] = currentPiece.color;
                }
            }
        }
    }
    
    checkLines();
    spawnNewPiece();
}

// Проверка заполненных линий
function checkLines() {
    let linesCleared = 0;
    
    for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
        let full = true;
        for (let col = 0; col < BOARD_WIDTH; col++) {
            if (!board[row][col]) {
                full = false;
                break;
            }
        }
        
        if (full) {
            board.splice(row, 1);
            board.unshift(Array(BOARD_WIDTH).fill(null));
            row++;
            linesCleared++;
        }
    }
    
    if (linesCleared > 0) {
        const points = [0, 100, 300, 500, 800];
        const addScore = points[linesCleared] * level;
        score += addScore;
        lines += linesCleared;
        
        const newLevel = Math.floor(lines / 10) + 1;
        if (newLevel > level) {
            level = newLevel;
            fallInterval = Math.max(100, 500 - (level - 1) * 30);
            if (gameRunning && !gamePaused) {
                clearInterval(gameLoop);
                startGameLoop();
            }
        }
        
        updateUI();
    }
}

// Спавн новой фигуры
function spawnNewPiece() {
    currentPiece = nextPiece;
    nextPiece = getRandomPiece();
    
    if (checkCollision(currentPiece, currentPiece.x, currentPiece.y)) {
        gameOver();
    }
    
    drawNext();
    drawBoard();
}

// Движение фигуры
function movePiece(dx, dy) {
    if (!gameRunning || gamePaused) return false;
    
    const newX = currentPiece.x + dx;
    const newY = currentPiece.y + dy;
    
    if (!checkCollision(currentPiece, newX, newY)) {
        currentPiece.x = newX;
        currentPiece.y = newY;
        drawBoard();
        return true;
    }
    
    if (dy === 1) {
        mergePiece();
        drawBoard();
    }
    
    return false;
}

// Поворот фигуры
function rotatePiece() {
    if (!gameRunning || gamePaused) return;
    
    const originalMatrix = currentPiece.matrix;
    const rotated = currentPiece.rotate();
    const originalX = currentPiece.x;
    const originalY = currentPiece.y;
    
    currentPiece.matrix = rotated;
    
    if (currentPiece.x + rotated[0].length > BOARD_WIDTH) {
        currentPiece.x = BOARD_WIDTH - rotated[0].length;
    }
    if (currentPiece.x < 0) {
        currentPiece.x = 0;
    }
    
    if (checkCollision(currentPiece, currentPiece.x, currentPiece.y)) {
        currentPiece.matrix = originalMatrix;
        currentPiece.x = originalX;
        currentPiece.y = originalY;
    }
    
    drawBoard();
}

// Сброс фигуры
function hardDrop() {
    if (!gameRunning || gamePaused) return;
    
    while (!checkCollision(currentPiece, currentPiece.x, currentPiece.y + 1)) {
        currentPiece.y++;
    }
    mergePiece();
    drawBoard();
}

// Обновление UI
function updateUI() {
    scoreElement.textContent = score;
    linesElement.textContent = lines;
    levelElement.textContent = level;
    
    if (score > highScore) {
        highScore = score;
        highScoreElement.textContent = highScore;
        localStorage.setItem('tetris_high_score', highScore);
    }
}

// Игровой цикл
function startGameLoop() {
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = setInterval(() => {
        if (gameRunning && !gamePaused) {
            movePiece(0, 1);
        }
    }, fallInterval);
}

// Начало игры
function startGame() {
    if (gameRunning && !gamePaused) {
        pauseGame();
    }
    
    board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(null));
    score = 0;
    lines = 0;
    level = 1;
    fallInterval = 500;
    gameRunning = true;
    gamePaused = false;
    
    nextPiece = getRandomPiece();
    currentPiece = getRandomPiece();
    
    updateUI();
    startGameLoop();
    
    startBtn.textContent = 'Рестарт';
    pauseBtn.disabled = false;
    pauseBtn.textContent = '⏸ Пауза';
    gameStatus.innerHTML = 'Игра идёт!';
    
    drawBoard();
    drawNext();
}

// Пауза
function pauseGame() {
    if (!gameRunning) return;
    
    gamePaused = !gamePaused;
    pauseBtn.textContent = gamePaused ? '▶ Продолжить' : '⏸ Пауза';
    gameStatus.innerHTML = gamePaused ? '⏸ Пауза' : 'Игра идёт!';
    drawBoard();
}

// Конец игры
function gameOver() {
    gameRunning = false;
    if (gameLoop) clearInterval(gameLoop);
    gameLoop = null;
    
    saveScoreToServer(score, level, lines);
    
    startBtn.textContent = '▶ Старт';
    pauseBtn.disabled = true;
    pauseBtn.textContent = '⏸ Пауза';
    gameStatus.innerHTML = ` ИГРА ОКОНЧЕНА! Ваш счёт: ${score}. Нажмите "Старт" `;
    
    drawBoard();
}

// Сброс игры
function resetGame() {
    if (gameLoop) clearInterval(gameLoop);
    startGame();
}

// Показать уведомление
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

// Управление с клавиатуры
function handleKeyDown(e) {
    if (!gameRunning) return;
    if (gamePaused && e.code !== 'Space') return;
    
    switch(e.code) {
        case 'ArrowLeft':
            e.preventDefault();
            movePiece(-1, 0);
            break;
        case 'ArrowRight':
            e.preventDefault();
            movePiece(1, 0);
            break;
        case 'ArrowDown':
            e.preventDefault();
            movePiece(0, 1);
            break;
        case 'ArrowUp':
            e.preventDefault();
            rotatePiece();
            break;
        case 'Space':
            e.preventDefault();
            if (gameRunning && !gamePaused) {
                hardDrop();
            } else if (!gameRunning) {
                startGame();
            }
            break;
        case 'KeyR':
            e.preventDefault();
            resetGame();
            break;
    }
}

// Кнопка назад
function goBack() {
    window.location.href = '../../index.html';
}

// Event listeners
startBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', pauseGame);
backBtn.addEventListener('click', goBack);
document.addEventListener('keydown', handleKeyDown);

// Инициализация
function init() {
    board = Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(null));
    drawBoard();
    gameStatus.innerHTML = 'Нажмите "Старт" для начала игры';
    
    if (getCurrentUser()) {
        loadUserBestScore();
    }
}

init();
