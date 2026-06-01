<?php
// Принудительно отключаем вывод ошибок в тело страницы, чтобы не ломать JSON-пакеты
ini_set('display_errors', 0);
error_reporting(E_ALL);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ПУТЬ К БАЗЕ ДАННЫХ: Файл базы данных SQL в папке вашего проекта
$dbPath = __DIR__ . DIRECTORY_SEPARATOR . 'gamez_store.db';

try {
    $db = new SQLite3($dbPath);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "db_init_error", "message" => "Не удалось запустить базу данных: " . $e->getMessage()]);
    exit;
}

// Автоматически создаем таблицу пользователей с колонкой 'role' и рекордами
$db->exec("CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    prog_lang TEXT NOT NULL,
    gender TEXT NOT NULL,
    bio TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    tetris_score INTEGER DEFAULT 0,
    tetris_level INTEGER DEFAULT 0,
    tetris_lines INTEGER DEFAULT 0,
    checkers_wins INTEGER DEFAULT 0,
    checkers_losses INTEGER DEFAULT 0
)");

// Добавляем колонки если их нет (для существующей базы)
$db->exec("ALTER TABLE users ADD COLUMN tetris_score INTEGER DEFAULT 0");
$db->exec("ALTER TABLE users ADD COLUMN tetris_level INTEGER DEFAULT 0");
$db->exec("ALTER TABLE users ADD COLUMN tetris_lines INTEGER DEFAULT 0");
$db->exec("ALTER TABLE users ADD COLUMN checkers_wins INTEGER DEFAULT 0");
$db->exec("ALTER TABLE users ADD COLUMN checkers_losses INTEGER DEFAULT 0");

// Создаем таблицу для игровых комнат (сетевая игра в шашки)
$db->exec("CREATE TABLE IF NOT EXISTS game_rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT NOT NULL UNIQUE,
    white_player TEXT,
    black_player TEXT,
    board TEXT,
    current_player TEXT DEFAULT 'white',
    status TEXT DEFAULT 'waiting',
    winner TEXT,
    rematch_requested INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)");

// Создаем главного админа GameZ, если его нет в базе данных SQL
$checkAdmin = $db->querySingle("SELECT COUNT(*) FROM users WHERE email = 'admin@gamez.com'");
if (empty($checkAdmin) || $checkAdmin == 0) {
    $db->exec("INSERT INTO users (email, password, phone, birth_date, prog_lang, gender, bio, role) 
               VALUES ('admin@z.com', '12345678', '+79991112233', '1995-01-01', 'C#', 'Мужской', 'администратор.', 'admin')");
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$input = json_decode(file_get_contents('php://input'), true);

// ==========================================================================
// 1. РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ
// ==========================================================================
if ($action === 'register' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $password = $input['password'];
    $phone = $input['phone'];
    $date = $input['date'];
    $lang = $input['lang'];
    $gender = $input['gender'];
    $bio = $input['bio'];

    $stmtCheck = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmtCheck->bindValue(':email', $email, SQLITE3_TEXT);
    $resCheck = $stmtCheck->execute();
    
    if ($resCheck->fetchArray()) {
        http_response_code(400);
        echo json_encode(["error" => "email_taken", "message" => "Этот адрес электронной почты уже занят."]);
        exit;
    }

    $stmt = $db->prepare("INSERT INTO users (email, password, phone, birth_date, prog_lang, gender, bio, role) 
                          VALUES (:email, :password, :phone, :date, :lang, :gender, :bio, 'user')");
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $stmt->bindValue(':password', $password, SQLITE3_TEXT);
    $stmt->bindValue(':phone', $phone, SQLITE3_TEXT);
    $stmt->bindValue(':date', $date, SQLITE3_TEXT);
    $stmt->bindValue(':lang', $lang, SQLITE3_TEXT);
    $stmt->bindValue(':gender', $gender, SQLITE3_TEXT);
    $stmt->bindValue(':bio', $bio, SQLITE3_TEXT);

    if ($stmt->execute()) {
        http_response_code(201);
        echo json_encode(["message" => "Пользователь успешно зарегистрирован в базе GameZ!"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "db_error", "message" => "Ошибка записи в базу данных."]);
    }
}

// ==========================================================================
// 2. ВХОД
// ==========================================================================
elseif ($action === 'login' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $password = $input['password'];

    $stmt = $db->prepare("SELECT * FROM users WHERE email = :email");
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);

    if (!$user) {
        http_response_code(404);
        echo json_encode(["error" => "not_found", "message" => "Данная учетная запись GameZ не существует."]);
        exit;
    }

    if ($user['password'] !== $password) {
        http_response_code(401);
        echo json_encode(["error" => "wrong_password", "message" => "Неверный пароль. Повторите попытку."]);
        exit;
    }

    unset($user['password']);
    echo json_encode(["message" => "Вход выполнен успешно!", "user" => $user]);
}

// ==========================================================================
// 3. АДМИНКА API: ПОЛУЧЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ (SELECT)
// ==========================================================================
elseif ($action === 'get_users' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $adminEmail = isset($_GET['admin_email']) ? strtolower(trim($_GET['admin_email'])) : '';

    $checkRole = $db->querySingle("SELECT role FROM users WHERE email = '" . $db->escapeString($adminEmail) . "'");
    
    if ($checkRole !== 'admin') {
        http_response_code(403);
        echo json_encode(["error" => "forbidden", "message" => "Доступ заблокирован. У вас нет прав администратора!"]);
        exit;
    }

    $results = $db->query("SELECT id, email, phone, birth_date, prog_lang, gender, bio, role, tetris_score, tetris_lines, checkers_wins, checkers_losses FROM users");
    $usersList = [];
    while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
        $usersList[] = $row;
    }
    echo json_encode($usersList);
}

// ==========================================================================
// 4. АДМИНКА API: РЕДАКТИРОВАНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ (UPDATE)
// ==========================================================================
elseif ($action === 'edit_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $adminEmail = isset($_GET['admin_email']) ? strtolower(trim($_GET['admin_email'])) : '';

    $checkRole = $db->querySingle("SELECT role FROM users WHERE email = '" . $db->escapeString($adminEmail) . "'");
    if ($checkRole !== 'admin') {
        http_response_code(403);
        echo json_encode(["error" => "forbidden", "message" => "Недостаточно прав для редактирования записей."]);
        exit;
    }

    $userId = intval($input['id']);
    $phone = $input['phone'];
    $date = $input['date'];
    $lang = $input['lang'];
    $gender = $input['gender'];
    $bio = $input['bio'];
    $role = $input['role'];

    $stmt = $db->prepare("UPDATE users SET phone = :phone, birth_date = :date, prog_lang = :lang, gender = :gender, bio = :bio, role = :role WHERE id = :id");
    $stmt->bindValue(':phone', $phone, SQLITE3_TEXT);
    $stmt->bindValue(':date', $date, SQLITE3_TEXT);
    $stmt->bindValue(':lang', $lang, SQLITE3_TEXT);
    $stmt->bindValue(':gender', $gender, SQLITE3_TEXT);
    $stmt->bindValue(':bio', $bio, SQLITE3_TEXT);
    $stmt->bindValue(':role', $role, SQLITE3_TEXT);
    $stmt->bindValue(':id', $userId, SQLITE3_INTEGER);

    if ($stmt->execute()) {
        echo json_encode(["message" => "Данные пользователя с ID $userId успешно обновлены в SQL!"]);
    } else {
        http_response_code(500);
        echo json_encode(["message" => "Не удалось обновить данные в базе."]);
    }
}

// ==========================================================================
// 5. АДМИНКА API: УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ ИЗ SQL ТАБЛИЦЫ (DELETE)
// ==========================================================================
elseif ($action === 'delete_user' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $adminEmail = isset($_GET['admin_email']) ? strtolower(trim($_GET['admin_email'])) : '';
    $userId = isset($_GET['id']) ? intval($_GET['id']) : 0;

    $checkRole = $db->querySingle("SELECT role FROM users WHERE email = '" . $db->escapeString($adminEmail) . "'");
    if ($checkRole !== 'admin') {
        http_response_code(403);
        echo json_encode(["error" => "forbidden", "message" => "Недостаточно прав для удаления записей."]);
        exit;
    }

    $stmt = $db->prepare("DELETE FROM users WHERE id = :id");
    $stmt->bindValue(':id', $userId, SQLITE3_INTEGER);
    
    if ($stmt->execute()) {
        echo json_encode(["message" => "Пользователь с ID $userId стерт из базы данных GameZ (SQL)!"]);
    } else {
        http_response_code(500);
        echo json_encode(["message" => "Не удалось удалить пользователя."]);
    }
}

// ==========================================================================
// 6. ОБНОВЛЕНИЕ БИОГРАФИИ ПОЛЬЗОВАТЕЛЯ (UPDATE)
// ==========================================================================
elseif ($action === 'update-bio' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $bio = $input['bio'];
    
    $stmtCheck = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmtCheck->bindValue(':email', $email, SQLITE3_TEXT);
    $resultCheck = $stmtCheck->execute();
    
    if (!$resultCheck->fetchArray()) {
        http_response_code(404);
        echo json_encode(["error" => "user_not_found", "message" => "Пользователь не найден."]);
        exit;
    }
    
    $stmt = $db->prepare("UPDATE users SET bio = :bio WHERE email = :email");
    $stmt->bindValue(':bio', $bio, SQLITE3_TEXT);
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    
    if ($stmt->execute()) {
        echo json_encode(["message" => "Биография успешно обновлена!"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "db_error", "message" => "Не удалось обновить биографию в базе данных."]);
    }
}

// ==========================================================================
// 7. СОЗДАНИЕ ИГРОВОЙ КОМНАТЫ (ДЛЯ СЕТЕВОЙ ИГРЫ)
// ==========================================================================
elseif ($action === 'create_game_room' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    
    $stmt = $db->prepare("SELECT id, role FROM users WHERE email = :email");
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(["success" => false, "error" => "unauthorized", "message" => "Необходимо авторизоваться"]);
        exit;
    }
    
    $characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    do {
        $roomCode = '';
        for ($i = 0; $i < 6; $i++) {
            $roomCode .= $characters[rand(0, strlen($characters) - 1)];
        }
        $checkRoom = $db->querySingle("SELECT COUNT(*) FROM game_rooms WHERE room_code = '$roomCode' AND status != 'finished'");
    } while ($checkRoom > 0);
    
    $stmt = $db->prepare("INSERT INTO game_rooms (room_code, white_player, status) VALUES (:code, :player, 'waiting')");
    $stmt->bindValue(':code', $roomCode, SQLITE3_TEXT);
    $stmt->bindValue(':player', $email, SQLITE3_TEXT);
    $stmt->execute();
    
    echo json_encode(["success" => true, "roomCode" => $roomCode, "color" => "white"]);
    exit;
}

// ==========================================================================
// 8. ПОДКЛЮЧЕНИЕ К КОМНАТЕ
// ==========================================================================
elseif ($action === 'join_game_room' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $roomCode = strtoupper(trim($input['roomCode']));
    
    $stmt = $db->prepare("SELECT id, role FROM users WHERE email = :email");
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(["success" => false, "error" => "unauthorized", "message" => "Необходимо авторизоваться"]);
        exit;
    }
    
    $stmt = $db->prepare("SELECT * FROM game_rooms WHERE room_code = :code AND status != 'finished'");
    $stmt->bindValue(':code', $roomCode, SQLITE3_TEXT);
    $result = $stmt->execute();
    $room = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$room) {
        echo json_encode(["success" => false, "error" => "not_found", "message" => "Комната не найдена"]);
        exit;
    }
    
    if ($room['status'] === 'playing') {
        echo json_encode(["success" => false, "error" => "already_started", "message" => "Игра уже началась"]);
        exit;
    }
    
    if ($room['black_player']) {
        echo json_encode(["success" => false, "error" => "full", "message" => "Комната заполнена"]);
        exit;
    }
    
    $stmt = $db->prepare("UPDATE game_rooms SET black_player = :player, status = 'ready' WHERE room_code = :code");
    $stmt->bindValue(':player', $email, SQLITE3_TEXT);
    $stmt->bindValue(':code', $roomCode, SQLITE3_TEXT);
    $stmt->execute();
    
    echo json_encode(["success" => true, "roomCode" => $roomCode, "color" => "black"]);
    exit;
}

// ==========================================================================
// 9. ПРОВЕРКА СТАТУСА КОМНАТЫ
// ==========================================================================
elseif ($action === 'check_game_room' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $roomCode = isset($_GET['roomCode']) ? strtoupper($_GET['roomCode']) : '';
    
    $stmt = $db->prepare("SELECT * FROM game_rooms WHERE room_code = :code");
    $stmt->bindValue(':code', $roomCode, SQLITE3_TEXT);
    $result = $stmt->execute();
    $room = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$room) {
        echo json_encode(["success" => false, "error" => "not_found", "message" => "Комната не найдена"]);
        exit;
    }
    
    echo json_encode([
        "success" => true,
        "white_player" => $room['white_player'],
        "black_player" => $room['black_player'],
        "status" => $room['status'],
        "current_player" => $room['current_player'],
        "board" => $room['board'] ? json_decode($room['board'], true) : null,
        "winner" => $room['winner']
    ]);
    exit;
}

// ==========================================================================
// 10. НАЧАТЬ ИГРУ
// ==========================================================================
elseif ($action === 'start_game' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $roomCode = strtoupper($input['roomCode']);
    $board = json_encode($input['board']);
    
    $stmt = $db->prepare("UPDATE game_rooms SET board = :board, status = 'playing', current_player = 'white' WHERE room_code = :code");
    $stmt->bindValue(':board', $board, SQLITE3_TEXT);
    $stmt->bindValue(':code', $roomCode, SQLITE3_TEXT);
    $stmt->execute();
    
    echo json_encode(["success" => true]);
    exit;
}

// ==========================================================================
// 11. СДЕЛАТЬ ХОД
// ==========================================================================
elseif ($action === 'make_game_move' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $roomCode = strtoupper($input['roomCode']);
    $board = json_encode($input['board']);
    $nextPlayer = $input['nextPlayer'];
    
    $stmt = $db->prepare("SELECT * FROM game_rooms WHERE room_code = :code");
    $stmt->bindValue(':code', $roomCode, SQLITE3_TEXT);
    $result = $stmt->execute();
    $room = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$room) {
        echo json_encode(["success" => false, "error" => "not_found", "message" => "Комната не найдена"]);
        exit;
    }
    
    $isWhiteTurn = $room['current_player'] === 'white';
    $isWhitePlayer = $room['white_player'] === $email;
    $isBlackPlayer = $room['black_player'] === $email;
    
    if (($isWhiteTurn && !$isWhitePlayer) || (!$isWhiteTurn && !$isBlackPlayer)) {
        echo json_encode(["success" => false, "error" => "not_your_turn", "message" => "Сейчас не ваш ход"]);
        exit;
    }
    
    $stmt = $db->prepare("UPDATE game_rooms SET board = :board, current_player = :next WHERE room_code = :code");
    $stmt->bindValue(':board', $board, SQLITE3_TEXT);
    $stmt->bindValue(':next', $nextPlayer, SQLITE3_TEXT);
    $stmt->bindValue(':code', $roomCode, SQLITE3_TEXT);
    $stmt->execute();
    
    echo json_encode(["success" => true]);
    exit;
}

// ==========================================================================
// 12. ЗАВЕРШИТЬ ИГРУ
// ==========================================================================
elseif ($action === 'end_game' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $roomCode = strtoupper($input['roomCode']);
    $winner = $input['winner'];
    
    $stmt = $db->prepare("UPDATE game_rooms SET status = 'finished', winner = :winner WHERE room_code = :code");
    $stmt->bindValue(':winner', $winner, SQLITE3_TEXT);
    $stmt->bindValue(':code', $roomCode, SQLITE3_TEXT);
    $stmt->execute();
    
    echo json_encode(["success" => true]);
    exit;
}

// ==========================================================================
// 13. ЗАПРОС РЕВАНША
// ==========================================================================
elseif ($action === 'request_rematch' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $roomCode = strtoupper($input['roomCode']);
    
    $rematchRequested = $db->querySingle("SELECT rematch_requested FROM game_rooms WHERE room_code = '$roomCode'");
    
    if ($rematchRequested) {
        $db->exec("UPDATE game_rooms SET rematch_requested = NULL, status = 'ready' WHERE room_code = '$roomCode'");
        echo json_encode(["success" => true, "rematchAccepted" => true]);
    } else {
        $db->exec("UPDATE game_rooms SET rematch_requested = 1 WHERE room_code = '$roomCode'");
        echo json_encode(["success" => true, "rematchAccepted" => false]);
    }
    exit;
}

// ==========================================================================
// 14. ПРОВЕРКА СТАТУСА РЕВАНША
// ==========================================================================
elseif ($action === 'check_rematch' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $roomCode = isset($_GET['roomCode']) ? strtoupper($_GET['roomCode']) : '';
    
    $rematchRequested = $db->querySingle("SELECT rematch_requested FROM game_rooms WHERE room_code = '$roomCode'");
    
    echo json_encode(["success" => true, "rematchAccepted" => $rematchRequested ? false : true]);
    exit;
}

// ==========================================================================
// 15. СБРОС КОМНАТЫ ДЛЯ НОВОЙ ИГРЫ
// ==========================================================================
elseif ($action === 'reset_game_room' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $roomCode = strtoupper($input['roomCode']);
    
    $db->exec("UPDATE game_rooms SET board = NULL, current_player = 'white', status = 'ready', winner = NULL, rematch_requested = NULL WHERE room_code = '$roomCode'");
    
    echo json_encode(["success" => true]);
    exit;
}

// ==========================================================================
// 16. СОХРАНЕНИЕ РЕКОРДА ТЕТРИСА
// ==========================================================================
elseif ($action === 'save_tetris_score' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $score = intval($input['score']);
    $level = intval($input['level']);
    $lines = intval($input['lines']);
    
    $stmt = $db->prepare("SELECT tetris_score FROM users WHERE email = :email");
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);
    
    if (!$user) {
        echo json_encode(["success" => false, "error" => "unauthorized"]);
        exit;
    }
    
    if ($score > $user['tetris_score']) {
        $stmt = $db->prepare("UPDATE users SET tetris_score = :score, tetris_level = :level, tetris_lines = :lines WHERE email = :email");
        $stmt->bindValue(':score', $score, SQLITE3_INTEGER);
        $stmt->bindValue(':level', $level, SQLITE3_INTEGER);
        $stmt->bindValue(':lines', $lines, SQLITE3_INTEGER);
        $stmt->bindValue(':email', $email, SQLITE3_TEXT);
        $stmt->execute();
        echo json_encode(["success" => true, "new_record" => true]);
    } else {
        echo json_encode(["success" => true, "new_record" => false]);
    }
    exit;
}

// ==========================================================================
// 17. ПОЛУЧЕНИЕ РЕКОРДА ТЕТРИСА
// ==========================================================================
elseif ($action === 'get_tetris_score' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $email = isset($_GET['email']) ? strtolower(trim($_GET['email'])) : '';
    
    $stmt = $db->prepare("SELECT tetris_score, tetris_level, tetris_lines FROM users WHERE email = :email");
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);
    
    if ($user) {
        echo json_encode([
            "success" => true,
            "score" => $user['tetris_score'],
            "level" => $user['tetris_level'],
            "lines" => $user['tetris_lines']
        ]);
    } else {
        echo json_encode(["success" => false, "error" => "user_not_found"]);
    }
    exit;
}

// ==========================================================================
// 18. ПОЛУЧЕНИЕ СТАТИСТИКИ ПОЛЬЗОВАТЕЛЯ
// ==========================================================================
elseif ($action === 'get_user_stats' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $email = isset($_GET['email']) ? strtolower(trim($_GET['email'])) : '';
    
    $stmt = $db->prepare("SELECT tetris_score, tetris_level, tetris_lines, checkers_wins, checkers_losses FROM users WHERE email = :email");
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $result = $stmt->execute();
    $user = $result->fetchArray(SQLITE3_ASSOC);
    
    if ($user) {
        echo json_encode(["success" => true, "stats" => $user]);
    } else {
        echo json_encode(["success" => false, "error" => "user_not_found"]);
    }
    exit;
}

// ==========================================================================
// 19. СОХРАНЕНИЕ РЕЗУЛЬТАТА ШАШЕК
// ==========================================================================
elseif ($action === 'save_checkers_result' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $result = $input['result'];
    
    $stmt = $db->prepare("SELECT checkers_wins, checkers_losses FROM users WHERE email = :email");
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $resultDb = $stmt->execute();
    $user = $resultDb->fetchArray(SQLITE3_ASSOC);
    
    if (!$user) {
        echo json_encode(["success" => false, "error" => "unauthorized"]);
        exit;
    }
    
    if ($result === 'win') {
        $newWins = $user['checkers_wins'] + 1;
        $stmt = $db->prepare("UPDATE users SET checkers_wins = :wins WHERE email = :email");
        $stmt->bindValue(':wins', $newWins, SQLITE3_INTEGER);
    } else {
        $newLosses = $user['checkers_losses'] + 1;
        $stmt = $db->prepare("UPDATE users SET checkers_losses = :losses WHERE email = :email");
        $stmt->bindValue(':losses', $newLosses, SQLITE3_INTEGER);
    }
    
    $stmt->bindValue(':email', $email, SQLITE3_TEXT);
    $stmt->execute();
    
    echo json_encode(["success" => true]);
    exit;
}

// ==========================================================================
// 20. НЕИЗВЕСТНОЕ ДЕЙСТВИЕ
// ==========================================================================
else {
    http_response_code(404);
    echo json_encode(["message" => "Метод или действие API не найдено."]);
}
?>
