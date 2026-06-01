// ==========================================================================
// СЕТЕВАЯ ИГРА В ШАШКИ (ТОЛЬКО ДЛЯ ДВУХ ИГРОКОВ)
// ==========================================================================

let currentUserEmail = null;
let currentUserName = null;
let roomCode = null;
let myColor = null;
let board = [];
let currentPlayer = 'white';
let gameActive = false;
let selectedPiece = null;
let validMoves = [];
let myTurn = false;
let updateInterval = null;
let waitingInterval = null;
let isProcessingMove = false;
let isWaitingForServer = false;

// DOM элементы
const authCheck = document.getElementById('auth-check');
const authWarning = document.getElementById('auth-warning');
const loadingAuth = document.getElementById('loading-auth');
const connectionScreen = document.getElementById('connection-screen');
const waitingScreen = document.getElementById('waiting-screen');
const gameInterface = document.getElementById('game-interface');
const boardElement = document.getElementById('board');
const turnIndicator = document.getElementById('turn-indicator');
const gameStatus = document.getElementById('game-status');
const whiteCountSpan = document.getElementById('white-count');
const blackCountSpan = document.getElementById('black-count');
const playerWhiteCard = document.getElementById('player-white-card');
const playerBlackCard = document.getElementById('player-black-card');
const whiteStatus = document.getElementById('white-status');
const blackStatus = document.getElementById('black-status');
const whiteEmailSpan = document.getElementById('white-email');
const blackEmailSpan = document.getElementById('black-email');
const roomCodeDisplay = document.getElementById('room-code-display');
const disconnectBtn = document.getElementById('disconnect-btn');
const resultModal = document.getElementById('game-result-modal');
const resultTitle = document.getElementById('result-title');
const resultMessage = document.getElementById('result-message');
const resultDetails = document.getElementById('result-details');
const resultIcon = document.getElementById('result-icon');

// ==========================================================================
// ПРОВЕРКА АВТОРИЗАЦИИ
// ==========================================================================

function checkAuth() {
    const activeEmail = localStorage.getItem('active_session_email');
    if (activeEmail) {
        const userData = JSON.parse(localStorage.getItem('cached_profile'));
        if (userData) {
            currentUserEmail = activeEmail;
            currentUserName = userData.email.split('@')[0];
            authCheck.style.display = 'none';
            connectionScreen.style.display = 'block';
            return true;
        }
    }
    
    authCheck.style.display = 'flex';
    authWarning.style.display = 'block';
    loadingAuth.style.display = 'none';
    connectionScreen.style.display = 'none';
    return false;
}

document.getElementById('go-to-login-btn')?.addEventListener('click', () => {
    window.location.href = '/';
});

// ==========================================================================
// ИНИЦИАЛИЗАЦИЯ ДОСКИ
// ==========================================================================

function initBoard() {
    board = Array(8).fill().map(() => Array(8).fill(null));
    
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
                board[row][col] = { color: 'black', isKing: false };
            }
        }
    }
    
    for (let row = 5; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            if ((row + col) % 2 === 1) {
                board[row][col] = { color: 'white', isKing: false };
            }
        }
    }
}

function copyBoard() {
    return JSON.parse(JSON.stringify(board));
}

function updateCounters() {
    let whiteCount = 0, blackCount = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const p = board[r][c];
            if (p) p.color === 'white' ? whiteCount++ : blackCount++;
        }
    }
    whiteCountSpan.textContent = whiteCount;
    blackCountSpan.textContent = blackCount;
    return { whiteCount, blackCount };
}

function checkKing(row, col, piece) {
    if (piece.color === 'white' && row === 0 && !piece.isKing) {
        piece.isKing = true;
        showToast('👑 Ваша шашка стала дамкой!');
        return true;
    } else if (piece.color === 'black' && row === 7 && !piece.isKing) {
        piece.isKing = true;
        showToast('👑 Шашка соперника стала дамкой!');
        return true;
    }
    return false;
}

function getMoveDirections(piece) {
    if (piece.isKing) {
        return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    } else if (piece.color === 'white') {
        return [[-1, -1], [-1, 1]];
    } else {
        return [[1, -1], [1, 1]];
    }
}

function getCaptureDirections(piece) {
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
}

function getSimpleMoves(row, col, piece) {
    const moves = [];
    const directions = getMoveDirections(piece);
    for (const [dr, dc] of directions) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !board[nr][nc]) {
            moves.push({ toRow: nr, toCol: nc, captures: null });
        }
    }
    return moves;
}

function getKingMoves(row, col, piece) {
    const moves = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of directions) {
        let nr = row + dr, nc = col + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8 && !board[nr][nc]) {
            moves.push({ toRow: nr, toCol: nc, captures: null });
            nr += dr; nc += dc;
        }
    }
    return moves;
}

function getSimpleCaptures(row, col, piece) {
    const captures = [];
    const directions = getCaptureDirections(piece);
    for (const [dr, dc] of directions) {
        const nr = row + dr, nc = col + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const target = board[nr][nc];
            if (target && target.color !== piece.color) {
                const jr = nr + dr, jc = nc + dc;
                if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !board[jr][jc]) {
                    captures.push({
                        toRow: jr,
                        toCol: jc,
                        captures: { row: nr, col: nc }
                    });
                }
            }
        }
    }
    return captures;
}

function getKingCaptures(row, col, piece) {
    const captures = [];
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of directions) {
        let nr = row + dr, nc = col + dc;
        let captureFound = null;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const target = board[nr][nc];
            if (!target) {
                nr += dr; nc += dc;
                continue;
            }
            if (target.color !== piece.color && !captureFound) {
                captureFound = { row: nr, col: nc };
                const jr = nr + dr, jc = nc + dc;
                if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !board[jr][jc]) {
                    captures.push({
                        toRow: jr,
                        toCol: jc,
                        captures: captureFound
                    });
                }
                break;
            } else {
                break;
            }
        }
    }
    return captures;
}

function getValidMoves(row, col, piece) {
    if (piece.isKing) {
        const captures = getKingCaptures(row, col, piece);
        if (captures.length > 0) return captures;
        return getKingMoves(row, col, piece);
    } else {
        const captures = getSimpleCaptures(row, col, piece);
        if (captures.length > 0) return captures;
        return getSimpleMoves(row, col, piece);
    }
}

function hasCaptureMoves(color) {
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === color) {
                const captures = piece.isKing ? getKingCaptures(row, col, piece) : getSimpleCaptures(row, col, piece);
                if (captures.length > 0) return true;
            }
        }
    }
    return false;
}

function getContinuationCaptures(row, col, piece) {
    if (piece.isKing) {
        return getKingCaptures(row, col, piece);
    } else {
        return getSimpleCaptures(row, col, piece);
    }
}

function makeMove(fromRow, fromCol, toRow, toCol, captures) {
    const piece = board[fromRow][fromCol];
    if (!piece) return false;
    
    board[toRow][toCol] = piece;
    board[fromRow][fromCol] = null;
    
    let hadCapture = false;
    if (captures) {
        board[captures.row][captures.col] = null;
        hadCapture = true;
    }
    
    checkKing(toRow, toCol, piece);
    return hadCapture;
}

function checkGameOver() {
    const { whiteCount, blackCount } = updateCounters();
    
    if (whiteCount === 0) return 'black';
    if (blackCount === 0) return 'white';
    
    const whiteMoves = getAllValidMoves('white').length;
    const blackMoves = getAllValidMoves('black').length;
    
    if (whiteMoves === 0) return 'black';
    if (blackMoves === 0) return 'white';
    
    return null;
}

function getAllValidMoves(color) {
    const moves = [];
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const piece = board[row][col];
            if (piece && piece.color === color) {
                const pieceMoves = getValidMoves(row, col, piece);
                for (const move of pieceMoves) {
                    moves.push({ fromRow: row, fromCol: col, ...move });
                }
            }
        }
    }
    return moves;
}

// ==========================================================================
// API ЗАПРОСЫ
// ==========================================================================

async function apiRequest(action, data = {}) {
    data.email = currentUserEmail;
    
    try {
        const response = await fetch(`/api.php?action=${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        console.log('API Response:', action, result);
        return result;
    } catch (error) {
        console.error('API Error:', error);
        showToast('Ошибка соединения с сервером');
        return null;
    }
}

async function apiGet(action, params = {}) {
    try {
        const url = new URL(`/api.php?action=${action}`, window.location.origin);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
        const response = await fetch(url);
        const result = await response.json();
        console.log('API GET Response:', action, result);
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return null;
    }
}

// ==========================================================================
// ИГРОВАЯ ЛОГИКА
// ==========================================================================

async function createRoom() {
    showToast('Создание комнаты...');
    const result = await apiRequest('create_game_room');
    
    if (result && result.success) {
        roomCode = result.roomCode;
        myColor = result.color;
        
        connectionScreen.style.display = 'none';
        waitingScreen.style.display = 'block';
        roomCodeDisplay.textContent = roomCode;
        
        startWaitingForOpponent();
    } else {
        showToast(result?.message || 'Ошибка создания комнаты');
    }
}

function startWaitingForOpponent() {
    if (waitingInterval) clearInterval(waitingInterval);
    
    waitingInterval = setInterval(async () => {
        const result = await apiGet('check_game_room', { roomCode: roomCode });
        if (result && result.success) {
            if (result.white_player && result.black_player) {
                clearInterval(waitingInterval);
                waitingInterval = null;
                startGame();
            }
        }
    }, 2000);
}

function cancelWaiting() {
    if (waitingInterval) {
        clearInterval(waitingInterval);
        waitingInterval = null;
    }
    waitingScreen.style.display = 'none';
    connectionScreen.style.display = 'block';
    selectedPiece = null;
    validMoves = [];
    showToast('Поиск соперника отменён');
}

async function joinRoom(code) {
    showToast('Подключение к комнате...');
    const result = await apiRequest('join_game_room', { roomCode: code });
    
    if (result && result.success) {
        roomCode = code;
        myColor = result.color;
        
        connectionScreen.style.display = 'none';
        
        const roomInfo = await apiGet('check_game_room', { roomCode: roomCode });
        if (roomInfo && roomInfo.success && roomInfo.white_player && roomInfo.black_player) {
            startGame();
        } else {
            waitingScreen.style.display = 'block';
            roomCodeDisplay.textContent = roomCode;
            startWaitingForOpponent();
        }
    } else {
        showToast(result?.message || 'Ошибка подключения');
    }
}

async function startGame() {
    waitingScreen.style.display = 'none';
    gameInterface.style.display = 'block';
    disconnectBtn.style.display = 'block';
    resultModal.classList.remove('show');
    
    initBoard();
    
    await apiRequest('start_game', {
        roomCode: roomCode,
        board: copyBoard()
    });
    
    const roomInfo = await apiGet('check_game_room', { roomCode: roomCode });
    if (roomInfo && roomInfo.success) {
        whiteEmailSpan.textContent = roomInfo.white_player;
        blackEmailSpan.textContent = roomInfo.black_player || 'Ожидание...';
    }
    
    gameActive = true;
    currentPlayer = 'white';
    myTurn = (myColor === 'white');
    isProcessingMove = false;
    isWaitingForServer = false;
    
    updateUI();
    renderBoard();
    startGameUpdates();
}

function updateUI() {
    if (myColor === 'white') {
        whiteStatus.textContent = 'Вы';
        blackStatus.textContent = 'Соперник';
    } else {
        whiteStatus.textContent = 'Соперник';
        blackStatus.textContent = 'Вы';
    }
    
    if (gameActive) {
        if (currentPlayer === myColor && !isProcessingMove && !isWaitingForServer) {
            turnIndicator.innerHTML = '🎮 Ваш ход';
            gameStatus.innerHTML = 'Ваш ход! Выберите шашку';
        } else if (currentPlayer === myColor && (isProcessingMove || isWaitingForServer)) {
            turnIndicator.innerHTML = '⏳ Обработка хода...';
            gameStatus.innerHTML = 'Подождите, обрабатывается ваш ход';
        } else {
            turnIndicator.innerHTML = '⏳ Ход соперника';
            gameStatus.innerHTML = 'Ожидайте хода соперника...';
        }
    }
    
    updateActiveCard();
}

function updateActiveCard() {
    if (!gameActive) return;
    if (currentPlayer === 'white') {
        playerWhiteCard.classList.add('active');
        playerBlackCard.classList.remove('active');
    } else {
        playerWhiteCard.classList.remove('active');
        playerBlackCard.classList.add('active');
    }
}

function startGameUpdates() {
    if (updateInterval) clearInterval(updateInterval);
    
    updateInterval = setInterval(async () => {
        if (!gameActive) return;
        
        const result = await apiGet('check_game_room', { roomCode: roomCode });
        if (result && result.success) {
            if (result.board) {
                const oldBoardStr = JSON.stringify(board);
                const newBoardStr = JSON.stringify(result.board);
                
                if (oldBoardStr !== newBoardStr) {
                    board = result.board;
                    currentPlayer = result.current_player;
                    myTurn = (currentPlayer === myColor);
                    isProcessingMove = false;
                    isWaitingForServer = false;
                    
                    selectedPiece = null;
                    validMoves = [];
                    
                    renderBoard();
                    updateUI();
                    
                    if (myTurn) {
                        showToast('Ваш ход!');
                    }
                }
            }
            
            if (result.winner) {
                gameActive = false;
                showGameResult(result.winner);
            }
        }
    }, 1000);
}

async function sendCompleteMove(finalBoard, nextPlayer) {
    isWaitingForServer = true;
    updateUI();
    
    const result = await apiRequest('make_game_move', {
        roomCode: roomCode,
        board: finalBoard,
        nextPlayer: nextPlayer
    });
    
    isWaitingForServer = false;
    
    if (result && result.success) {
        currentPlayer = nextPlayer;
        myTurn = (currentPlayer === myColor);
        isProcessingMove = false;
        updateUI();
        renderBoard();
    } else {
        showToast(result?.message || 'Ошибка отправки хода');
        isProcessingMove = false;
        updateUI();
    }
}

// ==========================================================================
// ОСНОВНАЯ ЛОГИКА ХОДОВ
// ==========================================================================

async function handlePlayerMove(row, col) {
    if (!gameActive || !myTurn || isProcessingMove || isWaitingForServer) {
        if (isProcessingMove) showToast('Подождите, обрабатывается ваш ход');
        else if (!myTurn) showToast('Сейчас не ваш ход');
        return false;
    }
    
    const piece = board[row][col];
    const captureRequired = hasCaptureMoves(myColor);
    
    if (!selectedPiece && piece && piece.color === myColor) {
        const moves = getValidMoves(row, col, piece);
        let movesToShow = moves;
        
        if (captureRequired) {
            movesToShow = moves.filter(m => m.captures);
            if (movesToShow.length === 0) {
                showToast('⚠️ У вас есть обязательное взятие!');
                return false;
            }
        }
        
        if (movesToShow.length > 0) {
            selectedPiece = { row, col };
            validMoves = movesToShow;
            renderBoard();
            gameStatus.innerHTML = '✅ Шашка выбрана. Нажмите на клетку для хода';
            return false;
        }
        return false;
    }
    
    if (selectedPiece) {
        const move = validMoves.find(m => m.toRow === row && m.toCol === col);
        if (move) {
            isProcessingMove = true;
            updateUI();
            
            const hadCapture = makeMove(selectedPiece.row, selectedPiece.col, row, col, move.captures);
            
            selectedPiece = null;
            validMoves = [];
            
            renderBoard();
            
            const winner = checkGameOver();
            if (winner) {
                gameActive = false;
                isProcessingMove = false;
                showGameResult(winner);
                return true;
            }
            
            if (hadCapture) {
                const movedPiece = board[row][col];
                const nextCaptures = getContinuationCaptures(row, col, movedPiece);
                
                if (nextCaptures.length > 0) {
                    selectedPiece = { row, col };
                    validMoves = nextCaptures;
                    gameStatus.innerHTML = '🔄 Бейте дальше! Выберите следующую клетку';
                    isProcessingMove = false;
                    updateUI();
                    renderBoard();
                    return false;
                }
            }
            
            const nextPlayer = myColor === 'white' ? 'black' : 'white';
            const finalBoard = copyBoard();
            
            await sendCompleteMove(finalBoard, nextPlayer);
            
            return true;
        } else {
            selectedPiece = null;
            validMoves = [];
            gameStatus.innerHTML = '❌ Ход отменён. Выберите другую шашку';
            renderBoard();
            return false;
        }
    }
    return false;
}

function renderBoard() {
    if (!boardElement) return;
    boardElement.innerHTML = '';
    updateCounters();
    
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const isDark = (row + col) % 2 === 1;
            const cell = document.createElement('div');
            cell.className = `cell ${isDark ? 'dark' : 'light'}`;
            
            if (selectedPiece && selectedPiece.row === row && selectedPiece.col === col) {
                cell.classList.add('selected');
            }
            
            if (selectedPiece && validMoves.some(m => m.toRow === row && m.toCol === col)) {
                cell.classList.add('valid-move');
                const move = validMoves.find(m => m.toRow === row && m.toCol === col);
                if (move && move.captures) cell.classList.add('valid-capture');
            }
            
            const piece = board[row][col];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.className = `piece ${piece.color} ${piece.isKing ? 'king' : ''}`;
                pieceDiv.textContent = piece.isKing ? '♕' : (piece.color === 'white' ? '●' : '○');
                pieceDiv.onclick = (e) => {
                    e.stopPropagation();
                    handlePlayerMove(row, col);
                };
                cell.appendChild(pieceDiv);
            }
            
            cell.onclick = () => handlePlayerMove(row, col);
            boardElement.appendChild(cell);
        }
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
}

function disconnect() {
    if (updateInterval) clearInterval(updateInterval);
    if (waitingInterval) clearInterval(waitingInterval);
    gameActive = false;
    isProcessingMove = false;
    isWaitingForServer = false;
    resultModal.classList.remove('show');
    connectionScreen.style.display = 'block';
    gameInterface.style.display = 'none';
    waitingScreen.style.display = 'none';
    disconnectBtn.style.display = 'none';
    selectedPiece = null;
    validMoves = [];
}

function goBack() {
    disconnect();
    window.location.href = '/';
}

async function startNewGame() {
    resultModal.classList.remove('show');
    
    await apiRequest('reset_game_room', { roomCode: roomCode });
    
    initBoard();
    
    await apiRequest('start_game', {
        roomCode: roomCode,
        board: copyBoard()
    });
    
    gameActive = true;
    currentPlayer = 'white';
    myTurn = (myColor === 'white');
    isProcessingMove = false;
    isWaitingForServer = false;
    
    updateUI();
    renderBoard();
    startGameUpdates();
    
    showToast('🔄 Новая игра началась!');
}

function showGameResult(winner) {
    gameActive = false;
    if (updateInterval) clearInterval(updateInterval);
    
    const isWinner = (winner === myColor);
    const whitePlayer = whiteEmailSpan.textContent;
    const blackPlayer = blackEmailSpan.textContent;
    
    const winnerName = winner === 'white' ? whitePlayer : blackPlayer;
    const loserName = winner === 'white' ? blackPlayer : whitePlayer;
    
    if (isWinner) {
        resultIcon.innerHTML = '🏆🎉🏆';
        resultTitle.innerHTML = 'ПОБЕДА!';
        resultTitle.style.color = '#ffd700';
        resultMessage.innerHTML = 'Поздравляем! Вы выиграли партию!';
        resultDetails.innerHTML = `
            <p>🏆 <span class="winner-name">${winnerName}</span> победил!</p>
            <p>😔 ${loserName} проиграл</p>
            <p>⭐ Отличная игра!</p>
        `;
        saveCheckersResult('win');
    } else {
        resultIcon.innerHTML = '😔💔😔';
        resultTitle.innerHTML = 'ПОРАЖЕНИЕ';
        resultTitle.style.color = '#e81123';
        resultMessage.innerHTML = 'Вы проиграли эту партию. Не отчаивайтесь!';
        resultDetails.innerHTML = `
            <p>🏆 Победитель: <span class="winner-name">${winnerName}</span></p>
            <p>😔 Вы проиграли</p>
            <p>💪 В следующий раз обязательно получится!</p>
        `;
        saveCheckersResult('loss');
    }
    
    apiRequest('end_game', { roomCode: roomCode, winner: winner });
    resultModal.classList.add('show');
}

async function saveCheckersResult(result) {
    if (!currentUserEmail) return;
    
    try {
        await apiRequest('save_checkers_result', {
            email: currentUserEmail,
            result: result
        });
    } catch (error) {
        console.error('Error saving checkers result:', error);
    }
}

// ==========================================================================
// EVENT LISTENERS
// ==========================================================================

document.getElementById('create-room-btn')?.addEventListener('click', createRoom);
document.getElementById('join-room-btn')?.addEventListener('click', () => {
    document.getElementById('join-room-panel').style.display = 'block';
});
document.getElementById('confirm-join-btn')?.addEventListener('click', () => {
    const code = document.getElementById('room-code-input').value.toUpperCase();
    if (code.length === 6) {
        joinRoom(code);
    } else {
        showToast('Введите 6-значный код');
    }
});
document.getElementById('cancel-join-btn')?.addEventListener('click', () => {
    document.getElementById('join-room-panel').style.display = 'none';
    document.getElementById('room-code-input').value = '';
});
document.getElementById('cancel-waiting-btn')?.addEventListener('click', cancelWaiting);
document.getElementById('back-btn')?.addEventListener('click', goBack);
document.getElementById('disconnect-btn')?.addEventListener('click', disconnect);
document.getElementById('rematch-btn')?.addEventListener('click', startNewGame);
document.getElementById('exit-result-btn')?.addEventListener('click', () => {
    resultModal.classList.remove('show');
    disconnect();
});

// Запуск
checkAuth();
