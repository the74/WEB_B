<?php
// Принудительно отключаем вывод ошибок в тело страницы
ini_set('display_errors', 0);
error_reporting(E_ALL);

header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// ==========================================================================
// НАСТРОЙКИ ПОДКЛЮЧЕНИЯ К MYSQL
// ==========================================================================
$db_host = 'localhost';
$db_user = 'u82458';      
$db_pass = '1626939';         
$db_name = 'u82458';       

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "db_init_error", "message" => "Не удалось подключиться к базе данных: " . $e->getMessage()]);
    exit;
}

// ==========================================================================
// СОЗДАНИЕ ТАБЛИЦ (ЕСЛИ ИХ НЕТ)
// ==========================================================================

// Таблица пользователей
$pdo->exec("CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    birth_date DATE NOT NULL,
    prog_lang VARCHAR(50) NOT NULL,
    gender VARCHAR(20) NOT NULL,
    bio TEXT,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    tetris_score INT DEFAULT 0,
    tetris_level INT DEFAULT 0,
    tetris_lines INT DEFAULT 0,
    checkers_wins INT DEFAULT 0,
    checkers_losses INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Таблица для игровых комнат
$pdo->exec("CREATE TABLE IF NOT EXISTS game_rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_code VARCHAR(6) NOT NULL UNIQUE,
    white_player VARCHAR(255),
    black_player VARCHAR(255),
    board LONGTEXT,
    current_player VARCHAR(10) DEFAULT 'white',
    status VARCHAR(20) DEFAULT 'waiting',
    winner VARCHAR(10),
    rematch_requested INT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// Проверка и добавление колонки rematch_requested (если нет)
try {
    $pdo->exec("ALTER TABLE game_rooms ADD COLUMN rematch_requested INT DEFAULT NULL");
} catch (PDOException $e) {
    // Колонка уже существует - игнорируем ошибку
}

// Создаем главного админа, если его нет
$stmt = $pdo->prepare("SELECT COUNT(*) FROM users WHERE email = 'admin@gamez.com'");
$stmt->execute();
$checkAdmin = $stmt->fetchColumn();

if (empty($checkAdmin) || $checkAdmin == 0) {
    $stmt = $pdo->prepare("INSERT INTO users (email, password, phone, birth_date, prog_lang, gender, bio, role) 
                           VALUES ('admin@gamez.com', 'admin777', '+79991112233', '1995-01-01', 'C#', 'Мужской', 'Главный администратор системы GameZ.', 'admin')");
    $stmt->execute();
}

$action = isset($_GET['action']) ? $_GET['action'] : '';
$input = json_decode(file_get_contents('php://input'), true);

// ==========================================================================
// 1. РЕГИСТРАЦИЯ
// ==========================================================================
if ($action === 'register' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $password = $input['password'];
    $phone = $input['phone'];
    $date = $input['date'];
    $lang = $input['lang'];
    $gender = $input['gender'];
    $bio = $input['bio'];

    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    
    if ($stmt->fetch()) {
        http_response_code(400);
        echo json_encode(["error" => "email_taken", "message" => "Этот адрес электронной почты уже занят."]);
        exit;
    }

    $stmt = $pdo->prepare("INSERT INTO users (email, password, phone, birth_date, prog_lang, gender, bio, role) 
                          VALUES (:email, :password, :phone, :date, :lang, :gender, :bio, 'user')");
    
    if ($stmt->execute([
        'email' => $email,
        'password' => $password,
        'phone' => $phone,
        'date' => $date,
        'lang' => $lang,
        'gender' => $gender,
        'bio' => $bio
    ])) {
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

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

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
// 3. АДМИНКА: ПОЛУЧЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ
// ==========================================================================
elseif ($action === 'get_users' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $adminEmail = isset($_GET['admin_email']) ? strtolower(trim($_GET['admin_email'])) : '';

    $stmt = $pdo->prepare("SELECT role FROM users WHERE email = :email");
    $stmt->execute(['email' => $adminEmail]);
    $checkRole = $stmt->fetchColumn();
    
    if ($checkRole !== 'admin') {
        http_response_code(403);
        echo json_encode(["error" => "forbidden", "message" => "Доступ заблокирован. У вас нет прав администратора!"]);
        exit;
    }

    $results = $pdo->query("SELECT id, email, phone, birth_date, prog_lang, gender, bio, role, tetris_score, tetris_lines, checkers_wins, checkers_losses FROM users");
    $usersList = $results->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($usersList);
}

// ==========================================================================
// 4. АДМИНКА: РЕДАКТИРОВАНИЕ
// ==========================================================================
elseif ($action === 'edit_user' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $adminEmail = isset($_GET['admin_email']) ? strtolower(trim($_GET['admin_email'])) : '';

    $stmt = $pdo->prepare("SELECT role FROM users WHERE email = :email");
    $stmt->execute(['email' => $adminEmail]);
    $checkRole = $stmt->fetchColumn();
    
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

    $stmt = $pdo->prepare("UPDATE users SET phone = :phone, birth_date = :date, prog_lang = :lang, gender = :gender, bio = :bio, role = :role WHERE id = :id");
    
    if ($stmt->execute([
        'phone' => $phone,
        'date' => $date,
        'lang' => $lang,
        'gender' => $gender,
        'bio' => $bio,
        'role' => $role,
        'id' => $userId
    ])) {
        echo json_encode(["message" => "Данные пользователя с ID $userId успешно обновлены!"]);
    } else {
        http_response_code(500);
        echo json_encode(["message" => "Не удалось обновить данные в базе."]);
    }
}

// ==========================================================================
// 5. АДМИНКА: УДАЛЕНИЕ
// ==========================================================================
elseif ($action === 'delete_user' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $adminEmail = isset($_GET['admin_email']) ? strtolower(trim($_GET['admin_email'])) : '';
    $userId = isset($_GET['id']) ? intval($_GET['id']) : 0;

    $stmt = $pdo->prepare("SELECT role FROM users WHERE email = :email");
    $stmt->execute(['email' => $adminEmail]);
    $checkRole = $stmt->fetchColumn();
    
    if ($checkRole !== 'admin') {
        http_response_code(403);
        echo json_encode(["error" => "forbidden", "message" => "Недостаточно прав для удаления записей."]);
        exit;
    }

    $stmt = $pdo->prepare("DELETE FROM users WHERE id = :id");
    $stmt->execute(['id' => $userId]);
    
    echo json_encode(["message" => "Пользователь с ID $userId удалён из базы данных!"]);
}

// ==========================================================================
// 6. ОБНОВЛЕНИЕ БИОГРАФИИ
// ==========================================================================
elseif ($action === 'update-bio' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $bio = $input['bio'];
    
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(["error" => "user_not_found", "message" => "Пользователь не найден."]);
        exit;
    }
    
    $stmt = $pdo->prepare("UPDATE users SET bio = :bio WHERE email = :email");
    $stmt->execute(['bio' => $bio, 'email' => $email]);
    
    echo json_encode(["message" => "Биография успешно обновлена!"]);
}

// ==========================================================================
// 7. СОЗДАНИЕ КОМНАТЫ
// ==========================================================================
elseif ($action === 'create_game_room' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    
    $stmt = $pdo->prepare("SELECT id, role FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
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
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM game_rooms WHERE room_code = :code AND status != 'finished'");
        $stmt->execute(['code' => $roomCode]);
        $checkRoom = $stmt->fetchColumn();
    } while ($checkRoom > 0);
    
    $stmt = $pdo->prepare("INSERT INTO game_rooms (room_code, white_player, status) VALUES (:code, :player, 'waiting')");
    $stmt->execute(['code' => $roomCode, 'player' => $email]);
    
    echo json_encode(["success" => true, "roomCode" => $roomCode, "color" => "white"]);
}

// ==========================================================================
// 8. ПОДКЛЮЧЕНИЕ К КОМНАТЕ
// ==========================================================================
elseif ($action === 'join_game_room' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $roomCode = strtoupper(trim($input['roomCode']));
    
    $stmt = $pdo->prepare("SELECT id, role FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        http_response_code(401);
        echo json_encode(["success" => false, "error" => "unauthorized", "message" => "Необходимо авторизоваться"]);
        exit;
    }
    
    $stmt = $pdo->prepare("SELECT * FROM game_rooms WHERE room_code = :code AND status != 'finished'");
    $stmt->execute(['code' => $roomCode]);
    $room = $stmt->fetch(PDO::FETCH_ASSOC);
    
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
    
    $stmt = $pdo->prepare("UPDATE game_rooms SET black_player = :player, status = 'ready' WHERE room_code = :code");
    $stmt->execute(['player' => $email, 'code' => $roomCode]);
    
    echo json_encode(["success" => true, "roomCode" => $roomCode, "color" => "black"]);
}

// ==========================================================================
// 9. ПРОВЕРКА СТАТУСА КОМНАТЫ
// ==========================================================================
elseif ($action === 'check_game_room' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $roomCode = isset($_GET['roomCode']) ? strtoupper($_GET['roomCode']) : '';
    
    $stmt = $pdo->prepare("SELECT * FROM game_rooms WHERE room_code = :code");
    $stmt->execute(['code' => $roomCode]);
    $room = $stmt->fetch(PDO::FETCH_ASSOC);
    
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
}

// ==========================================================================
// 10. НАЧАТЬ ИГРУ
// ==========================================================================
elseif ($action === 'start_game' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $roomCode = strtoupper($input['roomCode']);
    $board = json_encode($input['board']);
    
    $stmt = $pdo->prepare("UPDATE game_rooms SET board = :board, status = 'playing', current_player = 'white' WHERE room_code = :code");
    $stmt->execute(['board' => $board, 'code' => $roomCode]);
    
    echo json_encode(["success" => true]);
}

// ==========================================================================
// 11. СДЕЛАТЬ ХОД
// ==========================================================================
elseif ($action === 'make_game_move' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $roomCode = strtoupper($input['roomCode']);
    $board = json_encode($input['board']);
    $nextPlayer = $input['nextPlayer'];
    
    $stmt = $pdo->prepare("SELECT * FROM game_rooms WHERE room_code = :code");
    $stmt->execute(['code' => $roomCode]);
    $room = $stmt->fetch(PDO::FETCH_ASSOC);
    
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
    
    $stmt = $pdo->prepare("UPDATE game_rooms SET board = :board, current_player = :next WHERE room_code = :code");
    $stmt->execute(['board' => $board, 'next' => $nextPlayer, 'code' => $roomCode]);
    
    echo json_encode(["success" => true]);
}

// ==========================================================================
// 12. ЗАВЕРШИТЬ ИГРУ
// ==========================================================================
elseif ($action === 'end_game' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $roomCode = strtoupper($input['roomCode']);
    $winner = $input['winner'];
    
    $stmt = $pdo->prepare("UPDATE game_rooms SET status = 'finished', winner = :winner WHERE room_code = :code");
    $stmt->execute(['winner' => $winner, 'code' => $roomCode]);
    
    echo json_encode(["success" => true]);
}

// ==========================================================================
// 13. ЗАПРОС РЕВАНША
// ==========================================================================
elseif ($action === 'request_rematch' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $roomCode = strtoupper($input['roomCode']);
    
    $stmt = $pdo->prepare("SELECT rematch_requested FROM game_rooms WHERE room_code = :code");
    $stmt->execute(['code' => $roomCode]);
    $rematchRequested = $stmt->fetchColumn();
    
    if ($rematchRequested) {
        $stmt = $pdo->prepare("UPDATE game_rooms SET rematch_requested = NULL, status = 'ready' WHERE room_code = :code");
        $stmt->execute(['code' => $roomCode]);
        echo json_encode(["success" => true, "rematchAccepted" => true]);
    } else {
        $stmt = $pdo->prepare("UPDATE game_rooms SET rematch_requested = 1 WHERE room_code = :code");
        $stmt->execute(['code' => $roomCode]);
        echo json_encode(["success" => true, "rematchAccepted" => false]);
    }
}

// ==========================================================================
// 14. ПРОВЕРКА РЕВАНША
// ==========================================================================
elseif ($action === 'check_rematch' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $roomCode = isset($_GET['roomCode']) ? strtoupper($_GET['roomCode']) : '';
    
    $stmt = $pdo->prepare("SELECT rematch_requested FROM game_rooms WHERE room_code = :code");
    $stmt->execute(['code' => $roomCode]);
    $rematchRequested = $stmt->fetchColumn();
    
    echo json_encode(["success" => true, "rematchAccepted" => $rematchRequested ? false : true]);
}

// ==========================================================================
// 15. СБРОС КОМНАТЫ ДЛЯ НОВОЙ ИГРЫ
// ==========================================================================
elseif ($action === 'reset_game_room' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $roomCode = strtoupper($input['roomCode']);
    
    $stmt = $pdo->prepare("UPDATE game_rooms SET board = NULL, current_player = 'white', status = 'ready', winner = NULL, rematch_requested = NULL WHERE room_code = :code");
    $stmt->execute(['code' => $roomCode]);
    
    echo json_encode(["success" => true]);
}

// ==========================================================================
// 16. СОХРАНЕНИЕ РЕКОРДА ТЕТРИСА
// ==========================================================================
elseif ($action === 'save_tetris_score' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $score = intval($input['score']);
    $level = intval($input['level']);
    $lines = intval($input['lines']);
    
    $stmt = $pdo->prepare("SELECT tetris_score FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        echo json_encode(["success" => false, "error" => "unauthorized"]);
        exit;
    }
    
    if ($score > $user['tetris_score']) {
        $stmt = $pdo->prepare("UPDATE users SET tetris_score = :score, tetris_level = :level, tetris_lines = :lines WHERE email = :email");
        $stmt->execute(['score' => $score, 'level' => $level, 'lines' => $lines, 'email' => $email]);
        echo json_encode(["success" => true, "new_record" => true]);
    } else {
        echo json_encode(["success" => true, "new_record" => false]);
    }
}

// ==========================================================================
// 17. ПОЛУЧЕНИЕ РЕКОРДА ТЕТРИСА
// ==========================================================================
elseif ($action === 'get_tetris_score' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $email = isset($_GET['email']) ? strtolower(trim($_GET['email'])) : '';
    
    $stmt = $pdo->prepare("SELECT tetris_score, tetris_level, tetris_lines FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
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
}

// ==========================================================================
// 18. ПОЛУЧЕНИЕ СТАТИСТИКИ ПОЛЬЗОВАТЕЛЯ
// ==========================================================================
elseif ($action === 'get_user_stats' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $email = isset($_GET['email']) ? strtolower(trim($_GET['email'])) : '';
    
    $stmt = $pdo->prepare("SELECT tetris_score, tetris_level, tetris_lines, checkers_wins, checkers_losses FROM users WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($user) {
        echo json_encode(["success" => true, "stats" => $user]);
    } else {
        echo json_encode(["success" => false, "error" => "user_not_found"]);
    }
}

// ==========================================================================
// 19. СОХРАНЕНИЕ РЕЗУЛЬТАТА ШАШЕК
// ==========================================================================
elseif ($action === 'save_checkers_result' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $result = $input['result'];
    
    if ($result === 'win') {
        $stmt = $pdo->prepare("UPDATE users SET checkers_wins = checkers_wins + 1 WHERE email = :email");
    } else {
        $stmt = $pdo->prepare("UPDATE users SET checkers_losses = checkers_losses + 1 WHERE email = :email");
    }
    
    $stmt->execute(['email' => $email]);
    
    echo json_encode(["success" => true]);
}

// ==========================================================================
// 20. НЕИЗВЕСТНОЕ ДЕЙСТВИЕ
// ==========================================================================
else {
    http_response_code(404);
    echo json_encode(["message" => "Метод или действие API не найдено."]);
}
?>