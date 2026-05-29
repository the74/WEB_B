const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const comboLogDiv = document.getElementById('combo-log');

const gravity = 0.6;

// Состояния персонажа
const STATES = {
    IDLE: 'idle',
    WALK: 'walk',
    ATTACK: 'attack',
    HIT: 'hit',
    FROZEN: 'frozen'
};

// Класс ледяного снаряда
class IceBlast {
    constructor({ position, velocity }) {
        this.position = position;
        this.velocity = velocity;
        this.width = 40;
        this.height = 15;
        this.active = true;
    }

    draw() {
        if (!this.active) return;
        ctx.fillStyle = '#aaddff';
        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
        // Неоновое свечение льда
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(this.position.x + 5, this.position.y + 2, this.width - 10, this.height - 4);
    }

    update() {
        this.position.x += this.velocity.x;
        this.draw();
    }
}

// Класс Бойца
class Fighter {
    constructor({ position, color, enemyOffset }) {
        this.position = position;
        this.velocity = { x: 0, y: 0 };
        this.width = 60;
        this.height = 130;
        this.health = 100;
        this.color = color;
        
        this.state = STATES.IDLE;
        this.facing = 'right';
        this.isAttacking = false;

        // Зона атаки
        this.enemyOffset = enemyOffset; // Смещение зоны атаки
        this.attackBox = {
            position: { x: this.position.x, y: this.position.y },
            width: 90,
            height: 40
        };
    }

    draw() {
        // Меняем цвет блока в зависимости от состояния
        if (this.state === STATES.FROZEN) {
            ctx.fillStyle = '#00aaff'; // Синий лед при заморозке
        } else if (this.state === STATES.HIT) {
            ctx.fillStyle = '#ff3333'; // Красный при получении урона
        } else {
            ctx.fillStyle = this.color; // Обычный цвет бойца
        }

        // Рисуем тело бойца
        ctx.fillRect(this.position.x, this.position.y, this.width, this.height);

        // Рисуем "глаза" или полоску направления взгляда
        ctx.fillStyle = '#ffffff';
        if (this.facing === 'right') {
            ctx.fillRect(this.position.x + this.width - 15, this.position.y + 15, 10, 10);
        } else {
            ctx.fillRect(this.position.x + 5, this.position.y + 15, 10, 10);
        }

        // Отображение зоны удара при атаке
        if (this.isAttacking) {
            ctx.fillStyle = 'rgba(255, 255, 0, 0.4)';
            ctx.fillRect(this.attackBox.position.x, this.attackBox.position.y, this.attackBox.width, this.attackBox.height);
        }
    }

    update() {
        this.draw();
        
        // Обновление позиции зоны атаки перед персонажем
        if (this.facing === 'right') {
            this.attackBox.position.x = this.position.x + this.width;
        } else {
            this.attackBox.position.x = this.position.x - this.attackBox.width;
        }
        this.attackBox.position.y = this.position.y + 30;

        // Физика движения
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        // Гравитация
        if (this.position.y + this.height + this.velocity.y >= canvas.height - 40) {
            this.velocity.y = 0;
            this.position.y = canvas.height - 40 - this.height;
        } else {
            this.velocity.y += gravity;
        }

        // Границы экрана
        if (this.position.x < 0) this.position.x = 0;
        if (this.position.x + this.width > canvas.width) this.position.x = canvas.width - this.width;
    }

    attack() {
        if (this.state === STATES.HIT || this.state === STATES.FROZEN || this.isAttacking) return;
        this.isAttacking = true;
        this.state = STATES.ATTACK;
        setTimeout(() => { 
            this.isAttacking = false; 
            if (this.state === STATES.ATTACK) this.state = STATES.IDLE;
        }, 150);
    }

    shootIce() {
        if (this.state === STATES.HIT || this.state === STATES.FROZEN) return;
        this.state = STATES.ATTACK;
        
        const fSpeed = this.facing === 'right' ? 8 : -8;
        projectiles.push(new IceBlast({
            position: { x: this.position.x + (this.facing === 'right' ? this.width : -40), y: this.position.y + 40 },
            velocity: { x: fSpeed, y: 0 }
        }));

        setTimeout(() => { if (this.state === STATES.ATTACK) this.state = STATES.IDLE; }, 200);
    }

    takeDamage(amount, freezeEffect = false) {
        if (this.state === STATES.FROZEN && !freezeEffect) {
            this.state = STATES.IDLE; // Обычный удар разбивает лед
        }

        this.health -= amount;
        const healthBarId = (this === player1) ? 'p1-health' : 'p2-health';
        document.getElementById(healthBarId).style.width = Math.max(0, this.health) + '%';

        if (freezeEffect) {
            this.state = STATES.FROZEN;
            this.velocity.x = 0;
            setTimeout(() => { if (this.state === STATES.FROZEN) this.state = STATES.IDLE; }, 2000); // Лед на 2 секунды
            return;
        }

        this.state = STATES.HIT;
        this.position.x += (this.facing === 'right') ? -15 : 15; // Отлет назад

        setTimeout(() => { if (this.state === STATES.HIT) this.state = STATES.IDLE; }, 300);
    }
}

// Создаем двух уникальных неоновых бойцов
const player1 = new Fighter({ position: { x: 150, y: 0 }, color: '#00aaff' }); // Голубой Саб-Зиро
const player2 = new Fighter({ position: { x: 600, y: 0 }, color: '#00ff66' }); // Зеленый Рептилия
player2.facing = 'left';

const projectiles = [];
const keys = { 
    a: { pressed: false }, d: { pressed: false },
    ArrowLeft: { pressed: false }, ArrowRight: { pressed: false }
};

// Система комбо-приемов
let inputHistory = [];
const COMBO_TIMEOUT = 600;
let comboTimer;

function handleComboInput(key) {
    clearTimeout(comboTimer);
    inputHistory.push(key);
    const lastInputs = inputHistory.slice(-3).join('');
    
    // Комбо: S -> D -> Пробел (Вниз, Вперед, Удар)
    if (lastInputs === 'sd ') {
        comboLogDiv.innerText = "❄️ СУПЕРУДАР: ЛЕДЯНАЯ ЗАМОРОЗКА!";
        player1.shootIce();
        inputHistory = [];
        setTimeout(() => { comboLogDiv.innerText = ""; }, 2000);
        return true;
    }
    comboTimer = setTimeout(() => { inputHistory = []; }, COMBO_TIMEOUT);
    return false;
}

function checkCollision(rect1, rect2) {
    return (
        rect1.position.x < rect2.position.x + rect2.width &&
        rect1.position.x + rect1.width > rect2.position.x &&
        rect1.position.y < rect2.position.y + rect2.height &&
        rect1.position.y + rect1.height > rect2.position.y
    );
}

function checkAttackCollision(fighter, target) {
    const box = fighter.attackBox;
    return (
        box.position.x < target.position.x + target.width &&
        box.position.x + box.width > target.position.x &&
        box.position.y < target.position.y + target.height &&
        box.position.y + box.height > target.position.y
    );
}

// Главный цикл
function animate() {
    window.requestAnimationFrame(animate);
    
    // Отрисовка арены
    ctx.fillStyle = '#111116'; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Пол сцены
    ctx.fillStyle = '#222230';
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(0, canvas.height - 40, canvas.width, 4);

    // Авторазворот лицом друг к другу
    if (player1.state !== STATES.FROZEN && player2.state !== STATES.FROZEN && player1.state !== STATES.HIT && player2.state !== STATES.HIT) {
        player1.facing = (player1.position.x < player2.position.x) ? 'right' : 'left';
        player2.facing = (player2.position.x < player1.position.x) ? 'right' : 'left';
    }

    // Управление Игроком 1
    player1.velocity.x = 0;
    if (player1.state !== STATES.ATTACK && player1.state !== STATES.HIT && player1.state !== STATES.FROZEN) {
        if (keys.a.pressed) player1.velocity.x = -4;
        else if (keys.d.pressed) player1.velocity.x = 4;
    }

    // Управление Игроком 2
    player2.velocity.x = 0;
    if (player2.state !== STATES.ATTACK && player2.state !== STATES.HIT && player2.state !== STATES.FROZEN) {
        if (keys.ArrowLeft.pressed) player2.velocity.x = -4;
        else if (keys.ArrowRight.pressed) player2.velocity.x = 4;
    }

    player1.update();
    player2.update();

    // Коллизия ударов
    if (player1.isAttacking && checkAttackCollision(player1, player2)) {
        player1.isAttacking = false;
        player2.takeDamage(10);
    }
    if (player2.isAttacking && checkAttackCollision(player2, player1)) {
        player2.isAttacking = false;
        player1.takeDamage(10);
    }

    // Полет магии
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const fireball = projectiles[i];
        fireball.update();

        if (fireball.active && checkCollision(fireball, player2)) {
            fireball.active = false;
            player2.takeDamage(5, true); // Замораживает P2!
            projectiles.splice(i, 1);
            continue;
        }
        if (fireball.active && checkCollision(fireball, player1)) {
            fireball.active = false;
            player1.takeDamage(5, true); 
            projectiles.splice(i, 1);
            continue;
        }
        if (fireball.position.x < 0 || fireball.position.x > canvas.width) {
            projectiles.splice(i, 1);
        }
    }

    // Конец игры
    if (player1.health <= 0 || player2.health <= 0) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 36px "Courier New"';
        const winner = player1.health <= 0 ? "PLAYER 2 WINS" : "PLAYER 1 WINS";
        ctx.fillText(winner, canvas.width / 2 - 160, canvas.height / 2);
        ctx.font = '20px "Courier New"';
        ctx.fillText("Нажмите 'R' для перезапуска", canvas.width / 2 - 140, canvas.height / 2 + 50);
    }
}

animate();

// =========================================================================
// СЛУШАТЕЛИ КЛАВИАТУРЫ И СИСТЕМА КОМБО-ПРИЕМОВ ДЛЯ ИГРЫ
// =========================================================================

// Запуск главного игрового цикла (вызывается из обработчика DOM ниже)
// animate(); <-- Убрано отсюда по вашему требованию

// Отслеживание нажатий клавиш (Движение и атаки)
window.addEventListener('keydown', (event) => {
    const keyLower = event.key.toLowerCase();

    // Запись клавиш в историю для комбо-заморозки Игрока 1
    if (['s', 'd', ' '].includes(keyLower)) {
        const comboTriggered = handleComboInput(keyLower);
        if (comboTriggered) return; // Если комбо сработало, обычный удар не вызываем
    }

    switch (event.key) {
        // --- Управление Игроком 1 (A, D, W, Пробел) ---
        case 'd': case 'в': keys.d.pressed = true; break;
        case 'a': case 'ф': keys.a.pressed = true; break;
        case 'w': case 'ц': 
            // Прыжок разрешен только на земле и если игрок не заморожен
            if (player1.velocity.y === 0 && player1.state !== STATES.FROZEN) {
                player1.velocity.y = -14; 
            }
            break;
        case ' ': player1.attack(); break;

        // --- Управление Игроком 2 (Стрелки и Enter) ---
        case 'ArrowRight': keys.ArrowRight.pressed = true; break;
        case 'ArrowLeft': keys.ArrowLeft.pressed = true; break;
        case 'ArrowUp': 
            if (player2.velocity.y === 0 && player2.state !== STATES.FROZEN) {
                player2.velocity.y = -14; 
            }
            break;
        case 'Enter': player2.attack(); break;
        
        // --- Перезапуск раунда (Клавиша R) ---
        case 'r': case 'к':
            player1.health = 100; 
            player2.health = 100;
            document.getElementById('p1-health').style.width = '100%';
            document.getElementById('p2-health').style.width = '100%';
            player1.position = { x: 150, y: 0 }; 
            player2.position = { x: 600, y: 0 };
            player1.state = STATES.IDLE; 
            player2.state = STATES.IDLE;
            break;
    }
});

// Отслеживание отпускания клавиш (Остановка движения)
window.addEventListener('keyup', (event) => {
    switch (event.key) {
        // Отпускание кнопок Игрока 1
        case 'd': case 'в': keys.d.pressed = false; break;
        case 'a': case 'ф': keys.a.pressed = false; break;
        
        // Отпускание кнопок Игрока 2
        case 'ArrowRight': keys.ArrowRight.pressed = false; break;
        case 'ArrowLeft': keys.ArrowLeft.pressed = false; break;
    }
});

// =========================================================================
// БЕЗОПАСНЫЙ ЗАПУСК ИГРЫ ПОСЛЕ ПОЛНОЙ ЗАГРУЗКИ СТРАНИЦЫ БРАУЗЕРОМ
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
    console.log("Интерфейс и холст загружены. Боевой движок запущен!");
    animate(); // Контролируемый старт игры
});

