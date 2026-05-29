<?php
// Настройки заголовков для работы с JSON
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Подключение к базе данных SQLite3
$db = new SQLite3('./xbox_store.db');

// Автоматически создаем таблицу пользователей с колонкой 'role'
$db->exec("CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    phone TEXT NOT NULL,
    birth_date TEXT NOT NULL,
    prog_lang TEXT NOT NULL,
    gender TEXT NOT NULL,
    bio TEXT,
    role TEXT NOT NULL DEFAULT 'user'
)");

// Проверяем, создался ли первый главный админ. Если нет — создаем его автоматически!
// Логин админа: admin@the.com | Пароль: admin777
$checkAdmin = $db->querySingle("SELECT COUNT(*) FROM users WHERE email = 'admin@xbox.com'");
if ($checkAdmin == 0) {
    $db->exec("INSERT INTO users (email, password, phone, birth_date, prog_lang, gender, bio, role) 
               VALUES ('admin@the.com', 'admin777', '+79991112233', '1995-01-01', 'C#', 'Мужской', 'администратор.', 'admin')");
}

// Получаем действие из GET-параметра (например, api.php?action=login)
$action = isset($_GET['action']) ? $_GET['action'] : '';
$input = json_decode(file_get_contents('php://input'), true);

// ==========================================================================
// 1. РЕГИСТРАЦИЯ ПОЛЬЗОВАТЕЛЯ (Каждый новый получает роль 'user')
// ==========================================================================
if ($action === 'register' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = strtolower(trim($input['email']));
    $password = $input['password'];
    $phone = $input['phone'];
    $date = $input['date'];
    $lang = $input['lang'];
    $gender = $input['gender'];
    $bio = $input['bio'];

    // Проверяем, не занят ли email
    $stmtCheck = $db->prepare("SELECT id FROM users WHERE email = :email");
    $stmtCheck->bindValue(':email', $email, SQLITE3_TEXT);
    $resCheck = $stmtCheck->execute();
    
    if ($resCheck->fetchArray()) {
        http_response_code(400);
        echo json_encode(["error" => "email_taken", "message" => "Этот адрес электронной почты уже занят."]);
        exit;
    }

    // Записываем нового пользователя с ролью по умолчанию 'user'
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
        http_response_code(21);
        echo json_encode(["message" => "Пользователь успешно зарегистрирован в PHP-базе!"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "db_error", "message" => "Ошибка записи в базу данных."]);
    }
}

// ==========================================================================
// 2. ВХОД (Возвращает роль пользователя на фронтенд)
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
        echo json_encode(["error" => "not_found", "message" => "Данная учетная запись Xbox не существует."]);
        exit;
    }

    if ($user['password'] !== $password) {
        http_response_code(401);
        echo json_encode(["error" => "wrong_password", "message" => "Неверный пароль. Повторите попытку."]);
        exit;
    }

    // Удаляем пароль перед отправкой на фронтенд для безопасности
    unset($user['password']);
    echo json_encode(["message" => "Вход выполнен успешно!", "user" => $user]);
}

// ==========================================================================
// 3. АДМИНКА: ПОЛУЧЕНИЕ СПИСКА ПОЛЬЗОВАТЕЛЕЙ (Доступно только если role === 'admin')
// ==========================================================================
elseif ($action === 'get_users' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $adminEmail = isset($_GET['admin_email']) ? strtolower(trim($_GET['admin_email'])) : '';

    // Защита бэкенда: проверяем роль запрашивающего в самой базе SQL
    $checkRole = $db->querySingle("SELECT role FROM users WHERE email = '" . $db->escapeString($adminEmail) . "'");
    
    if ($checkRole !== 'admin') {
        http_response_code(403);
        echo json_encode(["error" => "forbidden", "message" => "Доступ заблокирован. У вас нет прав администратора!"]);
        exit;
    }

    $results = $db->query("SELECT id, email, phone, birth_date, prog_lang, gender, bio, role FROM users");
    $usersList = [];
    while ($row = $results->fetchArray(SQLITE3_ASSOC)) {
        $usersList[] = $row;
    }
    echo json_encode($usersList);
}

// ==========================================================================
// 4. АДМИНКА: УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ ИЗ SQL ТАБЛИЦЫ
// ==========================================================================
elseif ($action === 'delete_user' && $_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $adminEmail = isset($_GET['admin_email']) ? strtolower(trim($_GET['admin_email'])) : '';
    $userId = isset($_GET['id']) ? intval($_GET['id']) : 0;

    // Защита бэкенда от подделки запросов
    $checkRole = $db->querySingle("SELECT role FROM users WHERE email = '" . $db->escapeString($adminEmail) . "'");
    if ($checkRole !== 'admin') {
        http_response_code(403);
        echo json_encode(["error" => "forbidden", "message" => "Недостаточно прав для удаления записей."]);
        exit;
    }

    $stmt = $db->prepare("DELETE FROM users WHERE id = :id");
    $stmt->bindValue(':id', $userId, SQLITE3_INTEGER);
    
    if ($stmt->execute()) {
        echo json_encode(["message" => "Пользователь с ID $userId стерт из базы данных PHP (SQL)!"]);
    } else {
        http_response_code(500);
        echo json_encode(["message" => "Не удалось удалить пользователя."]);
    }
} else {
    http_response_code(404);
    echo json_encode(["message" => "Метод или действие API не найдено."]);
}
?>
