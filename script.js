document.addEventListener('DOMContentLoaded', () => {
    
    // Элементы навигации, слайдера и модального окна
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');
    const mainAuthBtn = document.getElementById('main-auth-btn');
    const viewProfileBtn = document.getElementById('view-profile-btn');
    const loginModal = document.getElementById('login-modal');
    const modalClose = document.getElementById('modal-close');
    
    const loginBlock = document.getElementById('auth-login-block');
    const registerBlock = document.getElementById('auth-register-block');
    const linkToRegister = document.getElementById('go-to-register');
    const linkToLogin = document.getElementById('go-to-login');

    const profileSection = document.getElementById('user-profile-section');
    const cartContainer = document.getElementById('cart-items-container');
    const cartTotalPrice = document.getElementById('cart-total-price');
    const checkoutBtn = document.getElementById('checkout-btn');

    let cart = []; // Массив для хранения добавленных товаров

    // Проверяем наличие активного входа при загрузке страницы
    checkUserSession();

    // ==========================================================================
    // 1. ЛОГИКА РАБОТЫ ИГРОВОГО СЛАЙДЕРА
    // ==========================================================================
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = document.getElementById('slider-prev');
    const nextBtn = document.getElementById('slider-next');
    
    let currentSlideIndex = 0;
    let sliderTimer = null;

    function showSlide(index) {
        if (index >= slides.length) currentSlideIndex = 0;
        if (index < 0) currentSlideIndex = slides.length - 1;

        slides.forEach(slide => slide.classList.remove('active-slide'));
        dots.forEach(dot => dot.classList.remove('active-dot'));

        if (slides[currentSlideIndex]) slides[currentSlideIndex].classList.add('active-slide');
        if (dots[currentSlideIndex]) dots[currentSlideIndex].classList.add('active-dot');
    }

    function nextSlide() { currentSlideIndex++; showSlide(currentSlideIndex); }
    function prevSlide() { currentSlideIndex--; showSlide(currentSlideIndex); }
    function startAutoSlider() { sliderTimer = setInterval(nextSlide, 5000); }
    function resetSliderTimer() { clearInterval(sliderTimer); startAutoSlider(); }

    if (nextBtn && prevBtn) {
        nextBtn.addEventListener('click', () => { nextSlide(); resetSliderTimer(); });
        prevBtn.addEventListener('click', () => { prevSlide(); resetSliderTimer(); });
    }

    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            currentSlideIndex = parseInt(e.target.getAttribute('data-index'));
            showSlide(currentSlideIndex);
            resetSliderTimer();
        });
    });

    startAutoSlider(); // Запуск слайдера

    // ==========================================================================
    // 2. ЛОГИКА ПЕРЕКЛЮЧЕНИЯ РАБОЧИХ ВКЛАДОК МЕНЮ
    // ==========================================================================
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const logoHome = document.getElementById('logo-home');

        function openTab(tabId) {
        tabContents.forEach(content => content.classList.remove('active-tab'));
        tabLinks.forEach(link => link.classList.remove('active-link'));
        
        const targetContent = document.getElementById(`tab-${tabId}`);
        if (targetContent) targetContent.classList.add('active-tab');

        const targetLink = document.querySelector(`[data-tab="${tabId}"]`);
        if (targetLink) targetLink.classList.add('active-link');

        if (tabId === 'admin') {
            loadSqlTable();
        }
    }


    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');
            openTab(tabId);
            
            if (navMenu && navMenu.classList.contains('open')) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('open');
            }
        });
    });

    if (logoHome) {
        logoHome.addEventListener('click', (e) => { e.preventDefault(); openTab('consoles'); });
    }

    openTab('consoles'); // Инициализация первой вкладки

    // ==========================================================================
    // 3. УПРАВЛЕНИЕ МЕНЮ-ГАМБУРГЕРОМ
    // ==========================================================================
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', (e) => {
            e.stopPropagation();
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!navMenu.contains(e.target) && !hamburger.contains(e.target)) {
                hamburger.classList.remove('active');
                navMenu.classList.remove('open');
            }
        });
    }

    // ==========================================================================
    // 4. ОТКРЫТИЕ И ЗАКРЫТИЕ МОДАЛЬНОГО ОКНА (ВХОД / ВЫХОД)
    // ==========================================================================
    if (mainAuthBtn && loginModal && modalClose) {
        mainAuthBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (mainAuthBtn.classList.contains('logout-btn')) {
                logoutUser();
            } else {
                loginModal.classList.add('show');
            }
        });

        modalClose.addEventListener('click', () => loginModal.classList.remove('show'));
        loginModal.addEventListener('click', (e) => { if (e.target === loginModal) loginModal.classList.remove('show'); });
    }

    if (linkToRegister && linkToLogin) {
        linkToRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginBlock.style.display = 'none';
            registerBlock.style.display = 'block';
            clearAllErrors();
        });

        linkToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerBlock.style.display = 'none';
            loginBlock.style.display = 'block';
            clearAllErrors();
        });
    }

    function clearAllErrors() {
        document.querySelectorAll('.error-message').forEach(err => err.classList.remove('show-error'));
        document.querySelectorAll('.input-group input, .input-group select, .input-group textarea').forEach(input => input.classList.remove('input-error'));
    }

    // Показать/скрыть пароль (Глаз)
    function setupPasswordToggle(toggleId, inputId) {
        const toggle = document.getElementById(toggleId);
        const input = document.getElementById(inputId);
        if (toggle && input) {
            toggle.addEventListener('click', () => {
                input.type = input.type === 'password' ? 'text' : 'password';
                toggle.textContent = input.type === 'password' ? '👁' : '🙈';
            });
        }
    }
    setupPasswordToggle('toggle-login-password', 'login-password');
    setupPasswordToggle('toggle-reg-password', 'reg-password');

    // ==========================================================================
    // 5. УПРАВЛЕНИЕ КУКАМИ ОШИБОК ДЛЯ ВАЛИДАЦИИ (COOKIES)
    // ==========================================================================
    function setErrorCookie(name, text) {
        try {
            document.cookie = `error_${name}=${encodeURIComponent(text)}; path=/; SameSite=Lax`;
            sessionStorage.setItem(`error_${name}`, text);
        } catch (e) {
            sessionStorage.setItem(`error_${name}`, text);
        }
    }

    function getAndDestroyErrorCookie(name) {
        let errorText = null;
        if (sessionStorage.getItem(`error_${name}`)) {
            errorText = sessionStorage.getItem(`error_${name}`);
            sessionStorage.removeItem(`error_${name}`);
        } 
        if (!errorText) {
            const matches = document.cookie.match(new RegExp("(?:^|; )" + `error_${name}`.replace(/([\.\$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"));
            if (matches) { errorText = decodeURIComponent(matches[1]); }
        }
        document.cookie = `error_${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
        return errorText;
    }

    function showError(inputElement, errorElement, cookieName, text) {
        setErrorCookie(cookieName, text);
        const textFromStorage = getAndDestroyErrorCookie(cookieName);
        inputElement.classList.add('input-error');
        errorElement.textContent = textFromStorage;
        errorElement.classList.add('show-error');
    }

    function hideError(inputElement, errorElement, cookieName) {
        inputElement.classList.remove('input-error');
        errorElement.classList.remove('show-error');
        sessionStorage.removeItem(`error_${cookieName}`);
        document.cookie = `error_${cookieName}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    }

    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }

        // ==========================================================================
    // ОБРАБОТКА ФОРМЫ ВХОДА (ПОДКЛЮЧЕНИЕ К PHP БЭКЕНДУ)
    // ==========================================================================
    const loginFormEl = document.getElementById('login-form');
    if (loginFormEl) {
        loginFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('login-email');
            const passwordInput = document.getElementById('login-password');
            const emailError = document.getElementById('login-email-error');
            const passwordError = document.getElementById('login-password-error');
            
            let isValid = true;
            if (!validateEmail(emailInput.value)) { showError(emailInput, emailError, 'login_email', 'Введите корректный email.'); isValid = false; }
            else { hideError(emailInput, emailError, 'login_email'); }

            if (passwordInput.value.length < 6) { showError(passwordInput, passwordError, 'login_password', 'Пароль от 6 символов.'); isValid = false; }
            else { hideError(passwordInput, passwordError, 'login_password'); }

            if (isValid) {
                try {
                    // Делаем запрос к файлу api.php с параметром действия login
                    const response = await fetch('api.php?action=login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailInput.value, password: passwordInput.value })
                    });
                    
                    const data = await response.json();

                    if (!response.ok) {
                        if (data.error === 'not_found') showError(emailInput, emailError, 'login_email', data.message);
                        if (data.error === 'wrong_password') showError(passwordInput, passwordError, 'login_password', data.message);
                    } else {
                        // Авторизация успешна! Сохраняем сессию
                        localStorage.setItem('active_session_email', emailInput.value.toLowerCase());
                        localStorage.setItem('cached_profile', JSON.stringify(data.user)); // Тут сохраняется и роль (user или admin)
                        
                        checkUserSession();
                        loginModal.classList.remove('show');
                        loginFormEl.reset();
                    }
                } catch (err) {
                    alert('Ошибка подключения к PHP API!');
                }
            }
        });
    }

    // ==========================================================================
    // ОБРАБОТКА РЕГИСТРАЦИИ В PHP БАЗУ
    // ==========================================================================
    const registerFormEl = document.getElementById('register-form');
    if (registerFormEl) {
        registerFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            // ... (Ваш блок валидации полей isValid оставляем без изменений) ...

            if (isValid) {
                const userAccount = {
                    email: email.value, password: password.value, phone: phone.value,
                    date: date.value, lang: lang.value, gender: gender.value, bio: bio.value
                };

                try {
                    const response = await fetch('api.php?action=register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(userAccount)
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        if (data.error === 'email_taken') showError(email, document.getElementById('reg-email-error'), 'reg_email', data.message);
                    } else {
                        alert(data.message);
                        registerBlock.style.display = 'none'; loginBlock.style.display = 'block';
                        registerFormEl.reset();
                    }
                } catch (err) {
                    alert('Ошибка отправки формы регистрации в PHP.');
                }
            }
        });
    }

    // ==========================================================================
    // КОНТРОЛЬ СЕССИЙ И СИНХРОНИЗАЦИЯ ПРАВ ДОСТУПА (USER / ADMIN)
    // ==========================================================================
    function checkUserSession() {
        const activeEmail = localStorage.getItem('active_session_email');
        const adminTabLink = document.querySelector('[data-tab="admin"]'); // Ссылка "Админка" в меню

        if (activeEmail) {
            const userData = JSON.parse(localStorage.getItem('cached_profile'));
            if (userData) {
                const userLoginName = userData.email.split('@');
                
                mainAuthBtn.textContent = `Выйти (${userLoginName})`;
                mainAuthBtn.classList.add('logout-btn');
                if (viewProfileBtn) viewProfileBtn.style.display = 'inline-block';

                // ОТОБРАЖЕНИЕ АДМИНКИ: Показываем кнопку в меню только если роль 'admin'
                if (adminTabLink) {
                    if (userData.role === 'admin') {
                        adminTabLink.style.display = 'inline-block';
                    } else {
                        adminTabLink.style.display = 'none'; // Обычный геймер вкладку не увидит
                    }
                }

                document.getElementById('prof-email').textContent = userData.email;
                document.getElementById('prof-phone').textContent = userData.phone;
                document.getElementById('prof-date').textContent = userData.birth_date || userData.date;
                document.getElementById('prof-gender').textContent = userData.gender;
                document.getElementById('prof-lang').textContent = userData.prog_lang || userData.lang;
                
                const bioText = document.getElementById('prof-bio-text');
                if (bioText) bioText.textContent = userData.bio;
                
                return;
            }
        }
        
        // Если никто не авторизован — прячем личный кабинет и админку
        mainAuthBtn.textContent = 'Войти';
        mainAuthBtn.classList.remove('logout-btn');
        if (viewProfileBtn) viewProfileBtn.style.display = 'none';
        if (adminTabLink) adminTabLink.style.display = 'none';
        profileSection.style.display = 'none';
        profileSection.classList.remove('open');
    }

    // ==========================================================================
    // ФУНКЦИЯ ЗАГРУЗКИ ТАБЛИЦЫ С ПРОВЕРКОЙ ПРАВ АДМИНА ЧЕРЕЗ PHP
    // ==========================================================================
    async function loadSqlTable() {
        const tableBody = document.getElementById('admin-table-body');
        if (!tableBody) return;

        const activeEmail = localStorage.getItem('active_session_email') || '';

        try {
            // Передаем email текущего пользователя, чтобы сервер проверил роль
            const response = await fetch(`api.php?action=get_users&admin_email=${activeEmail}`);
            
            if (response.status === 403) {
                tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #e81123; font-weight: bold;">Доступ заблокирован. У вас нет прав администратора!</td></tr>`;
                return;
            }
            
            const users = await response.json();

            if (users.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #666;">База данных SQL пуста.</td></tr>`;
                return;
            }

            tableBody.innerHTML = '';
            users.forEach(user => {
                const rowHTML = `
                    <tr>
                        <td>${user.id}</td>
                        <td>${user.email} ${user.role === 'admin' ? '<span style="color:#107c10;">(Админ)</span>' : ''}</td>
                        <td>${user.phone}</td>
                        <td>${user.birth_date}</td>
                        <td>${user.prog_lang}</td>
                        <td>${user.gender}</td>
                        <td>${user.bio || '-'}</td>
                        <td>
                            <!-- Запрещаем админу удалять самого себя -->
                            <button class="admin-delete-btn" data-id="${user.id}" ${user.email === activeEmail ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}>Удалить</button>
                        </td>
                    </tr>
                `;
                tableBody.insertAdjacentHTML('beforeend', rowHTML);
            });

            // Логика удаления
            document.querySelectorAll('.admin-delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    if (confirm(`Удалить геймера с ID ${id} из базы данных SQL?`)) {
                        try {
                            const delRes = await fetch(`api.php?action=delete_user&id=${id}&admin_email=${activeEmail}`, { method: 'DELETE' });
                            const delData = await delRes.json();
                            alert(delData.message);
                            loadSqlTable();
                        } catch (err) { alert('Ошибка PHP при удалении.'); }
                    }
                });
            });

        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #e81123;">Ошибка связи с PHP бэкендом.</td></tr>`;
        }
    }

    // ==========================================================================
    // 10. ЛОГИКА РАБОТЫ КОРЗИНЫ МАГАЗИНА
    // ==========================================================================
    function updateCartUI() {
        if (!cartContainer || !cartTotalPrice) return;

        if (cart.length === 0) {
            cartContainer.innerHTML = '<p class="empty-cart-text">Корзина пуста. Перейдите в Магазин для покупок.</p>';
            cartTotalPrice.textContent = '0 ₽';
            if (checkoutBtn) checkoutBtn.style.display = 'none';
            return;
        }

        cartContainer.innerHTML = '';
        let total = 0;

        cart.forEach((item, index) => {
            total += item.price;
            const itemHTML = `
                <div class="cart-item">
                    <div class="cart-item-title">${item.name}</div>
                    <div class="cart-item-right">
                        <div class="cart-item-price">${item.price.toLocaleString()} ₽</div>
                        <button class="remove-item-btn" data-index="${index}">&times;</button>
                    </div>
                </div>
            `;
            cartContainer.insertAdjacentHTML('beforeend', itemHTML);
        });

        cartTotalPrice.textContent = `${total.toLocaleString()} ₽`;
        if (checkoutBtn) checkoutBtn.style.display = 'block';

        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const indexToRemove = parseInt(e.target.getAttribute('data-index'));
                cart.splice(indexToRemove, 1);
                updateCartUI();
            });
        });
    }

    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const activeEmail = localStorage.getItem('active_session_email');
            if (!activeEmail) {
                alert('Пожалуйста, войдите в свой профиль Xbox или зарегистрируйтесь, чтобы совершать покупки.');
                if (loginModal) loginModal.classList.add('show');
                return;
            }

            const productCard = e.target.closest('.shop-product-card');
            if (productCard) {
                const id = productCard.getAttribute('data-id');
                const name = productCard.getAttribute('data-name');
                const price = parseInt(productCard.getAttribute('data-price'));

                cart.push({ id, name, price });
                updateCartUI();
                alert(`Игра "${name}" добавлена в корзину! Откройте Личный кабинет, чтобы оформить заказ.`);
            }
        });
    });

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            alert(`Заказ на сумму ${cartTotalPrice.textContent} успешно сформирован! Спасибо за покупку в магазине Xbox.`);
            cart = [];
            updateCartUI();
        });
    }

    // ==========================================================================
    // 11. ЖИВОЙ ПОИСК ПО ИГРАМ И ТОВАРАМ
    // ==========================================================================
    const searchInput = document.getElementById('xbox-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const filter = searchInput.value.toLowerCase();
            const allCards = document.querySelectorAll('.card');

            allCards.forEach(card => {
                const title = card.querySelector('h3');
                if (title) {
                    const textValue = title.textContent || title.innerText;
                    card.style.display = textValue.toLowerCase().indexOf(filter) > -1 ? 'flex' : 'none';
                }
            });
        });
    }
});

    // ==========================================================================
    // ФУНКЦИЯ ДИНАМИЧЕСКОЙ ЗАГРУЗКИ ТАБЛИЦЫ ИЗ БАЗЫ ДАННЫХ SQL
    // ==========================================================================
    async function loadSqlTable() {
        const tableBody = document.getElementById('admin-table-body');
        if (!tableBody) return;

        try {
            const response = await fetch('/api/admin/users');
            const users = await response.json();

            // Если пользователей в базе нет
            if (users.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #666;">База данных SQL пуста. Зарегистрируйте первого пользователя!</td></tr>`;
                return;
            }

            // Очищаем таблицу и наполняем строками из базы
            tableBody.innerHTML = '';
            users.forEach(user => {
                const rowHTML = `
                    <tr id="sql-row-${user.id}">
                        <td>${user.id}</td>
                        <td>${user.email}</td>
                        <td>${user.phone}</td>
                        <td>${user.birth_date}</td>
                        <td>${user.prog_lang}</td>
                        <td>${user.gender}</td>
                        <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.bio || '-'}</td>
                        <td>
                            <button class="admin-delete-btn" data-id="${user.id}">Удалить</button>
                        </td>
                    </tr>
                `;
                tableBody.insertAdjacentHTML('beforeend', rowHTML);
            });

            // Навешиваем события удаления на созданные красные кнопки
            document.querySelectorAll('.admin-delete-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.target.getAttribute('data-id');
                    
                    if (confirm(`Вы уверены, что хотите навсегда удалить пользователя с ID ${id} из базы данных SQL?`)) {
                        try {
                            const delResponse = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
                            const delData = await delResponse.json();

                            if (delResponse.ok) {
                                alert(delData.message);
                                loadSqlTable(); // Перезагружаем таблицу, чтобы строка исчезла
                            }
                        } catch (err) {
                            alert('Ошибка удаления записи.');
                        }
                    }
                });
            });

        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #e81123;">Ошибка подключения к API админ-панели.</td></tr>`;
        }
    }

