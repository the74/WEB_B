// Ждем полной загрузки структуры документа
document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================================================
    // 0. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
    // ==========================================================================
    function safeGetElement(id) {
        const element = document.getElementById(id);
        if (!element) console.warn(`Элемент #${id} не найден в DOM`);
        return element;
    }

    // ==========================================================================
    // 1. ИНИЦИАЛИЗАЦИЯ ПЕРЕМЕННЫХ
    // ==========================================================================
    const hamburger = safeGetElement('hamburger');
    const navMenu = safeGetElement('nav-menu');
    const mainAuthBtn = safeGetElement('main-auth-btn');
    const viewProfileBtn = safeGetElement('view-profile-btn');
    const loginModal = safeGetElement('login-modal');
    const modalClose = safeGetElement('modal-close');
    
    const loginBlock = safeGetElement('auth-login-block');
    const registerBlock = safeGetElement('auth-register-block');
    const linkToRegister = safeGetElement('go-to-register');
    const linkToLogin = safeGetElement('go-to-login');

    const profileSection = safeGetElement('user-profile-section');
    const cartContainer = safeGetElement('cart-items-container');
    const cartTotalPrice = safeGetElement('cart-total-price');
    const checkoutBtn = safeGetElement('checkout-btn');

    // Загружаем корзину
    let cart = [];
    try {
        const savedCart = localStorage.getItem('gamez_user_cart');
        cart = savedCart ? JSON.parse(savedCart) : [];
    } catch(e) { cart = []; }

    // Проверяем сессию
    checkUserSession();
    setupLiveErrorCleaner();
    initScrollAnimations();

    // ==========================================================================
    // 2. СЛАЙДЕР
    // ==========================================================================
    const slides = document.querySelectorAll('.slide');
    const dots = document.querySelectorAll('.dot');
    const prevBtn = safeGetElement('slider-prev');
    const nextBtn = safeGetElement('slider-next');
    
    let currentSlideIndex = 0;
    let sliderTimer = null;

    function showSlide(index) {
        if (!slides.length) return;
        if (index >= slides.length) currentSlideIndex = 0;
        if (index < 0) currentSlideIndex = slides.length - 1;

        slides.forEach(slide => slide.classList.remove('active-slide'));
        dots.forEach(dot => dot.classList.remove('active-dot'));

        if (slides[currentSlideIndex]) slides[currentSlideIndex].classList.add('active-slide');
        if (dots[currentSlideIndex]) dots[currentSlideIndex].classList.add('active-dot');
    }

    function nextSlide() { currentSlideIndex++; showSlide(currentSlideIndex); }
    function prevSlide() { currentSlideIndex--; showSlide(currentSlideIndex); }
    function startAutoSlider() { if (sliderTimer) clearInterval(sliderTimer); sliderTimer = setInterval(nextSlide, 5000); }
    function resetSliderTimer() { clearInterval(sliderTimer); startAutoSlider(); }

    if (nextBtn && prevBtn && slides.length) {
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

    if (slides.length) startAutoSlider();

    // ==========================================================================
    // 3. ПЛАВНЫЙ СКРОЛЛ
    // ==========================================================================
    const scrollLinks = document.querySelectorAll('.scroll-link');
    const pageSections = document.querySelectorAll('.page-section');

    scrollLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerOffset = 70;
                const elementPosition = targetSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({ top: offsetPosition, behavior: "smooth" });
            }

            if (navMenu && navMenu.classList.contains('open')) {
                if (hamburger) hamburger.classList.remove('active');
                navMenu.classList.remove('open');
            }
        });
    });

    window.addEventListener('scroll', () => {
        let currentSectionId = "";
        const scrollPosition = window.scrollY + 100;

        pageSections.forEach(section => {
            if (section.id === 'section-admin' && section.style.display === 'none') return;
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSectionId = "#" + section.id;
            }
        });

        scrollLinks.forEach(link => {
            link.classList.remove('active-scroll-link');
            if (link.getAttribute('href') === currentSectionId) {
                link.classList.add('active-scroll-link');
            }
        });
    });

    // ==========================================================================
    // 4. ГАМБУРГЕР
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
    // 5. МОДАЛЬНОЕ ОКНО
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
            if (loginBlock) loginBlock.style.display = 'none';
            if (registerBlock) registerBlock.style.display = 'block';
            clearAllErrors();
        });

        linkToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            if (registerBlock) registerBlock.style.display = 'none';
            if (loginBlock) loginBlock.style.display = 'block';
            clearAllErrors();
        });
    }

    function clearAllErrors() {
        document.querySelectorAll('.error-message').forEach(err => {
            err.classList.remove('show-error');
            err.textContent = '';
        });
        document.querySelectorAll('.input-group input, .input-group select, .input-group textarea').forEach(input => {
            input.classList.remove('input-error');
        });
    }

    function setupPasswordToggle(toggleId, inputId) {
        const toggle = safeGetElement(toggleId);
        const input = safeGetElement(inputId);
        if (toggle && input) {
            toggle.addEventListener('click', () => {
                input.type = input.type === 'password' ? 'text' : 'password';
                toggle.textContent = input.type === 'password' ? '👁' : ':)';
            });
        }
    }
    setupPasswordToggle('toggle-login-password', 'login-password');
    setupPasswordToggle('toggle-reg-password', 'reg-password');

    // ==========================================================================
    // 6. ВАЛИДАЦИЯ
    // ==========================================================================
    
    function showError(inputElement, errorElement, message) {
        if (!inputElement || !errorElement) return;
        inputElement.classList.add('input-error');
        errorElement.textContent = message;
        errorElement.classList.add('show-error');
    }

    function hideError(inputElement, errorElement) {
        if (!inputElement || !errorElement) return;
        inputElement.classList.remove('input-error');
        errorElement.classList.remove('show-error');
        errorElement.textContent = '';
    }

    function setupLiveErrorCleaner() {
        const allInputs = document.querySelectorAll('.input-group input, .input-group select, .input-group textarea, .checkbox-group input');
        allInputs.forEach(input => {
            const eventType = (input.tagName === 'SELECT' || input.type === 'checkbox' || input.type === 'date') ? 'change' : 'input';
            input.addEventListener(eventType, () => {
                if (input.classList.contains('input-error')) {
                    input.classList.remove('input-error');
                    const parent = input.closest('.input-group') || input.closest('.checkbox-group');
                    if (parent) {
                        const errMessage = parent.querySelector('.error-message');
                        if (errMessage) {
                            errMessage.classList.remove('show-error');
                            errMessage.textContent = '';
                        }
                    }
                }
            });
        });
    }

    function validateEmail(email) {
        const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }

    function validateRussianPhone(phone) {
        const cleanPhone = phone.replace(/[\s\-\(\)\_]/g, '');
        const phonePattern = /^(\+7|8|7)?(\d{10})$/;
        const match = cleanPhone.match(phonePattern);
        
        if (!match) return false;
        if (match[2] && match[2].length === 10 && !match[1]) return true;
        
        const hasPrefix = match[1] === '+7' || match[1] === '8' || match[1] === '7';
        const hasElevenDigits = match[2] && match[2].length === 11;
        
        if (hasPrefix && hasElevenDigits) return true;
        if (match[2] && match[2].length === 11 && !match[1]) return true;
        
        return false;
    }

    function formatRussianPhone(phone) {
        const cleanPhone = phone.replace(/[\s\-\(\)\_]/g, '');
        
        if (/^\d{10}$/.test(cleanPhone)) {
            return `+7 (${cleanPhone.slice(0,3)}) ${cleanPhone.slice(3,6)}-${cleanPhone.slice(6,8)}-${cleanPhone.slice(8,10)}`;
        }
        if (/^\d{11}$/.test(cleanPhone)) {
            return `+${cleanPhone.slice(0,1)} (${cleanPhone.slice(1,4)}) ${cleanPhone.slice(4,7)}-${cleanPhone.slice(7,9)}-${cleanPhone.slice(9,11)}`;
        }
        if (/^8\d{10}$/.test(cleanPhone)) {
            return `+7 (${cleanPhone.slice(1,4)}) ${cleanPhone.slice(4,7)}-${cleanPhone.slice(7,9)}-${cleanPhone.slice(9,11)}`;
        }
        if (/^\+7\d{10}$/.test(cleanPhone)) {
            return `+7 (${cleanPhone.slice(2,5)}) ${cleanPhone.slice(5,8)}-${cleanPhone.slice(8,10)}-${cleanPhone.slice(10,12)}`;
        }
        return phone;
    }

    // ==========================================================================
    // 7. ЛОГИН
    // ==========================================================================
    const loginFormEl = safeGetElement('login-form');
    if (loginFormEl) {
        loginFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = safeGetElement('login-email');
            const passwordInput = safeGetElement('login-password');
            const emailError = safeGetElement('login-email-error');
            const passwordError = safeGetElement('login-password-error');
            
            if (!emailInput || !passwordInput) {
                alert('Ошибка: элементы формы не найдены');
                return;
            }
            
            let isLoginFormValid = true;

            if (!validateEmail(emailInput.value)) { 
                showError(emailInput, emailError, 'Введите действительный адрес электронной почты.'); 
                isLoginFormValid = false; 
            } else { 
                hideError(emailInput, emailError); 
            }

            if (passwordInput.value.length < 4) { 
                showError(passwordInput, passwordError, 'Пароль должен содержать не менее 4 символов.'); 
                isLoginFormValid = false; 
            } else { 
                hideError(passwordInput, passwordError); 
            }

            if (isLoginFormValid) {
                try {
                    const response = await fetch('api.php?action=login', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: emailInput.value, password: passwordInput.value })
                    });
                    
                    const data = await response.json();

                    if (!response.ok) {
                        if (data.error === 'not_found') showError(emailInput, emailError, data.message);
                        if (data.error === 'wrong_password') showError(passwordInput, passwordError, data.message);
                    } else {
                        localStorage.setItem('active_session_email', emailInput.value.toLowerCase());
                        localStorage.setItem('cached_profile', JSON.stringify(data.user));
                        
                        checkUserSession();
                        if (loginModal) loginModal.classList.remove('show');
                        loginFormEl.reset();
                        clearAllErrors();
                    }
                } catch (err) {
                    alert('Ошибка подключения к PHP API! Подробности: ' + err.message);
                }
            }
        });
    }

    // ==========================================================================
    // 8. РЕГИСТРАЦИЯ
    // ==========================================================================
    const registerFormEl = safeGetElement('register-form');
    if (registerFormEl) {
        registerFormEl.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const regEmail = safeGetElement('reg-email');
            const regPassword = safeGetElement('reg-password');
            const regPhone = safeGetElement('reg-phone');
            const regDate = safeGetElement('reg-date');
            const regLang = safeGetElement('reg-lang');
            const regBio = safeGetElement('reg-bio');
            const regContract = safeGetElement('reg-contract');
            const regGender = document.querySelector('input[name="reg-gender"]:checked');

            let isRegFormValid = true;

            if (!regEmail || !regPassword || !regPhone || !regDate || !regLang || !regBio || !regContract) {
                alert('Ошибка: не все поля формы найдены');
                return;
            }

            if (!validateEmail(regEmail.value)) { 
                showError(regEmail, safeGetElement('reg-email-error'), 'Введите корректный email.'); 
                isRegFormValid = false; 
            } else { 
                hideError(regEmail, safeGetElement('reg-email-error')); 
            }

            if (regPassword.value.length < 4) { 
                showError(regPassword, safeGetElement('reg-password-error'), 'Пароль должен быть не менее 4 символов.'); 
                isRegFormValid = false; 
            } else { 
                hideError(regPassword, safeGetElement('reg-password-error')); 
            }

            const phoneValue = regPhone.value.trim();
            if (phoneValue === '') { 
                showError(regPhone, safeGetElement('reg-phone-error'), 'Введите номер телефона.'); 
                isRegFormValid = false; 
            } else if (!validateRussianPhone(phoneValue)) { 
                showError(regPhone, safeGetElement('reg-phone-error'), 'Введите российский номер телефона. Пример: +7 (912) 345-67-89'); 
                isRegFormValid = false; 
            } else { 
                hideError(regPhone, safeGetElement('reg-phone-error'));
                const formattedPhone = formatRussianPhone(phoneValue);
                regPhone.value = formattedPhone;
            }

            const dateValue = regDate.value;
            if (!dateValue) { 
                showError(regDate, safeGetElement('reg-date-error'), 'Укажите вашу дату рождения.'); 
                isRegFormValid = false; 
            } else {
                const birthDate = new Date(dateValue);
                const today = new Date();
                let age = today.getFullYear() - birthDate.getFullYear();
                const monthDiff = today.getMonth() - birthDate.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) { age--; }

                if (birthDate > today) { 
                    showError(regDate, safeGetElement('reg-date-error'), 'Дата рождения не может быть в будущем.'); 
                    isRegFormValid = false; 
                } else if (age < 14) { 
                    showError(regDate, safeGetElement('reg-date-error'), 'Для регистрации вам должно быть не менее 14 лет.'); 
                    isRegFormValid = false; 
                } else if (age > 120) { 
                    showError(regDate, safeGetElement('reg-date-error'), 'Пожалуйста, укажите настоящую дату рождения.'); 
                    isRegFormValid = false; 
                } else { 
                    hideError(regDate, safeGetElement('reg-date-error')); 
                }
            }

            if (!regLang.value) { 
                showError(regLang, safeGetElement('reg-lang-error'), 'Выберите язык программирования.'); 
                isRegFormValid = false; 
            } else { 
                hideError(regLang, safeGetElement('reg-lang-error')); 
            }

            if (regBio.value.trim() === '') { 
                showError(regBio, safeGetElement('reg-bio-error'), 'Напишите хотя бы пару слов о себе.'); 
                isRegFormValid = false; 
            } else { 
                hideError(regBio, safeGetElement('reg-bio-error')); 
            }

            if (!regContract.checked) { 
                showError(regContract, safeGetElement('reg-contract-error'), 'Вы должны подтвердить согласие с контрактом.'); 
                isRegFormValid = false; 
            } else { 
                hideError(regContract, safeGetElement('reg-contract-error')); 
            }

            if (isRegFormValid) {
                const cleanPhone = regPhone.value.replace(/[\s\-\(\)]/g, '');
                
                const userAccount = {
                    email: regEmail.value, 
                    password: regPassword.value, 
                    phone: cleanPhone,
                    date: regDate.value, 
                    lang: regLang.value, 
                    gender: regGender ? regGender.value : 'Мужской', 
                    bio: regBio.value
                };

                try {
                    const response = await fetch('api.php?action=register', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(userAccount)
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        if (data.error === 'email_taken') {
                            showError(regEmail, safeGetElement('reg-email-error'), data.message);
                        } else {
                            alert('Ошибка: ' + (data.message || 'Неизвестная ошибка'));
                        }
                    } else {
                        alert(data.message);
                        
                        localStorage.setItem('active_session_email', regEmail.value.toLowerCase());
                        
                        const mockUserData = {
                            email: regEmail.value, 
                            phone: cleanPhone, 
                            birth_date: regDate.value,
                            prog_lang: regLang.value, 
                            gender: regGender ? regGender.value : 'Мужской', 
                            bio: regBio.value, 
                            role: 'user'
                        };
                        localStorage.setItem('cached_profile', JSON.stringify(mockUserData));
                        
                        checkUserSession();
                        
                        if (loginModal) loginModal.classList.remove('show');
                        registerFormEl.reset();
                        clearAllErrors();
                    }
                } catch (err) {
                    alert('Ошибка отправки формы регистрации: ' + err.message);
                }
            }
        });
    }

    // ==========================================================================
    // 9. СЕССИЯ, ПРОФИЛЬ И СТАТИСТИКА
    // ==========================================================================
    
    async function loadUserStats() {
        const activeEmail = localStorage.getItem('active_session_email');
        if (!activeEmail) return;
        
        try {
            const response = await fetch(`api.php?action=get_user_stats&email=${activeEmail}`);
            const result = await response.json();
            
            if (result.success && result.stats) {
                const stats = result.stats;
                
                const tetrisScoreEl = document.getElementById('profile-tetris-score');
                const tetrisLevelEl = document.getElementById('profile-tetris-level');
                const tetrisLinesEl = document.getElementById('profile-tetris-lines');
                const checkersWinsEl = document.getElementById('profile-checkers-wins');
                const checkersLossesEl = document.getElementById('profile-checkers-losses');
                
                if (tetrisScoreEl) tetrisScoreEl.textContent = stats.tetris_score || 0;
                if (tetrisLevelEl) tetrisLevelEl.textContent = stats.tetris_level || 0;
                if (tetrisLinesEl) tetrisLinesEl.textContent = stats.tetris_lines || 0;
                if (checkersWinsEl) checkersWinsEl.textContent = stats.checkers_wins || 0;
                if (checkersLossesEl) checkersLossesEl.textContent = stats.checkers_losses || 0;
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }

    function checkUserSession() {
        const activeEmail = localStorage.getItem('active_session_email');
        const adminMenuLink = safeGetElement('admin-menu-link'); 
        const adminSection = safeGetElement('section-admin');     

        if (activeEmail) {
            const userData = JSON.parse(localStorage.getItem('cached_profile'));
            if (userData) {
                const userLoginName = userData.email.split('@');
                
                if (mainAuthBtn) {
                    mainAuthBtn.textContent = `Выйти (${userLoginName[0]})`;
                    mainAuthBtn.classList.add('logout-btn');
                }
                if (viewProfileBtn) viewProfileBtn.style.display = 'inline-block';

                if (adminMenuLink) {
                    if (userData.role === 'admin') {
                        adminMenuLink.style.display = 'inline-block';
                        if (adminSection) {
                            adminSection.style.display = 'block';
                            loadSqlTable(); 
                        }
                    } else {
                        adminMenuLink.style.display = 'none';
                        if (adminSection) adminSection.style.display = 'none';
                    }
                }

                const profEmail = safeGetElement('prof-email');
                const profPhone = safeGetElement('prof-phone');
                const profDate = safeGetElement('prof-date');
                const profGender = safeGetElement('prof-gender');
                const profLang = safeGetElement('prof-lang');
                const profBioText = safeGetElement('prof-bio-text');
                
                if (profEmail) profEmail.textContent = userData.email;
                if (profPhone) profPhone.textContent = userData.phone;
                if (profDate) profDate.textContent = userData.birth_date || userData.date;
                if (profGender) profGender.textContent = userData.gender;
                if (profLang) profLang.textContent = userData.prog_lang || userData.lang;
                if (profBioText) profBioText.textContent = userData.bio;
                
                if (profileSection) {
                    profileSection.style.display = 'block';
                    profileSection.classList.add('open');
                }
                
                loadUserStats();
                updateCartUI(); 
                return;
            }
        }
        
        if (mainAuthBtn) {
            mainAuthBtn.textContent = 'Войти';
            mainAuthBtn.classList.remove('logout-btn');
        }
        if (viewProfileBtn) viewProfileBtn.style.display = 'none';
        if (adminMenuLink) adminMenuLink.style.display = 'none';
        if (adminSection) adminSection.style.display = 'none';
        if (profileSection) {
            profileSection.style.display = 'none';
            profileSection.classList.remove('open');
        }
    }

    if (viewProfileBtn) {
        viewProfileBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!profileSection) return;
            
            const isAlreadyOpen = profileSection.style.display === 'block' && profileSection.classList.contains('open');

            if (!isAlreadyOpen) {
                profileSection.style.display = 'block';
                profileSection.classList.add('open');

                const headerOffset = 70;
                const elementPosition = profileSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({ top: offsetPosition, behavior: "smooth" });
            } else {
                profileSection.style.display = 'none';
                profileSection.classList.remove('open');
            }

            if (navMenu && navMenu.classList.contains('open')) {
                if (hamburger) hamburger.classList.remove('active');
                navMenu.classList.remove('open');
            }
        });
    }

    // ==========================================================================
    // 10. РЕДАКТИРОВАНИЕ БИОГРАФИИ
    // ==========================================================================
    const editBioBtn = safeGetElement('edit-bio-btn');
    const saveBioBtn = safeGetElement('save-bio-btn');
    const profBioText = safeGetElement('prof-bio-text');
    const editBioInput = safeGetElement('edit-bio-input');

    if (editBioBtn && saveBioBtn && profBioText && editBioInput) {
        editBioBtn.addEventListener('click', () => {
            editBioInput.value = profBioText.textContent;
            profBioText.style.display = 'none';
            editBioInput.style.display = 'block';
            editBioBtn.style.display = 'none';
            saveBioBtn.style.display = 'inline-block';
        });

        saveBioBtn.addEventListener('click', async () => {
            const activeEmail = localStorage.getItem('active_session_email');
            if (activeEmail) {
                try {
                    const response = await fetch('api.php?action=update-bio', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: activeEmail, bio: editBioInput.value })
                    });

                    if (response.ok) {
                        const cachedData = JSON.parse(localStorage.getItem('cached_profile'));
                        cachedData.bio = editBioInput.value;
                        localStorage.setItem('cached_profile', JSON.stringify(cachedData));

                        profBioText.textContent = editBioInput.value;
                        profBioText.style.display = 'inline';
                        editBioInput.style.display = 'none';
                        editBioBtn.style.display = 'inline-block';
                        saveBioBtn.style.display = 'none';
                        alert('Биография успешно обновлена!');
                    } else {
                        alert('Ошибка при обновлении биографии');
                    }
                } catch (err) {
                    alert('Не удалось обновить запись: ' + err.message);
                }
            }
        });
    }

    function logoutUser() {
        localStorage.removeItem('active_session_email');
        localStorage.removeItem('cached_profile');
        cart = JSON.parse(localStorage.getItem('gamez_user_cart')) || [];
        checkUserSession();
        alert('Вы успешно вышли из учетной записи GameZ Live.');
    }

    // ==========================================================================
    // 11. КОРЗИНА
    // ==========================================================================
    function updateCartUI() {
        if (!cartContainer || !cartTotalPrice) return;

        if (cart.length === 0) {
            cartContainer.innerHTML = '<p class="empty-cart-text">Корзина пуста</p>';
            cartTotalPrice.textContent = '0 ₽';
            if (checkoutBtn) checkoutBtn.style.display = 'none';
            return;
        }

        cartContainer.innerHTML = '';
        let total = 0;

        cart.forEach((item, index) => {
            total += item.price;
            const escapedName = item.name.replace(/[&<>]/g, function(m) {
                if (m === '&') return '&amp;';
                if (m === '<') return '&lt;';
                if (m === '>') return '&gt;';
                return m;
            });
            const itemHTML = `
                <div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #222;">
                    <div class="cart-item-title" style="font-size: 14px;">${escapedName}</div>
                    <div style="display:flex; align-items:center; gap:16px;">
                        <div class="cart-item-price" style="color:#107c10; font-weight:700;">${item.price.toLocaleString()} ₽</div>
                        <button class="remove-item-btn" data-index="${index}" style="background:transparent; border:none; color:#e81123; font-size:20px; cursor:pointer;">&times;</button>
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
                localStorage.setItem('gamez_user_cart', JSON.stringify(cart));
                updateCartUI();
            });
        });
    }

    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const activeEmail = localStorage.getItem('active_session_email');
            if (!activeEmail) {
                alert('Пожалуйста, войдите в свой профиль GameZ или зарегистрируйтесь.');
                if (loginModal) loginModal.classList.add('show');
                return;
            }

            const productCard = e.target.closest('.shop-product-card');
            if (productCard) {
                const id = productCard.getAttribute('data-id');
                const name = productCard.getAttribute('data-name');
                const price = parseInt(productCard.getAttribute('data-price'));

                cart.push({ id, name, price });
                localStorage.setItem('gamez_user_cart', JSON.stringify(cart));
                updateCartUI();
                showToast(`"${name}" добавлено в корзину!`);
            }
        });
    });

    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', () => {
            const total = cart.reduce((sum, item) => sum + item.price, 0);
            showToast(`Заказ на сумму ${total.toLocaleString()} ₽ успешно оформлен!`);
            cart = [];
            localStorage.setItem('gamez_user_cart', JSON.stringify(cart));
            updateCartUI();
        });
    }

    // ==========================================================================
    // 12. ПОИСК
    // ==========================================================================
    const searchInput = safeGetElement('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const filter = searchInput.value.toLowerCase();
            const allCards = document.querySelectorAll('.card');

            allCards.forEach(card => {
                const title = card.querySelector('h3');
                if (title) {
                    const textValue = title.textContent || title.innerText;
                    if (textValue.toLowerCase().indexOf(filter) > -1) {
                        card.style.display = 'flex';
                    } else {
                        card.style.display = 'none';
                    }
                }
            });
        });
    }
    
    // ==========================================================================
    // 13. АНИМАЦИЯ КАРТОЧЕК ПРИ СКРОЛЛЕ
    // ==========================================================================
    function initScrollAnimations() {
        const cards = document.querySelectorAll('.card');
        
        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { 
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            });
            
            cards.forEach(card => {
                observer.observe(card);
            });
        } else {
            cards.forEach(card => {
                card.classList.add('visible');
            });
        }
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
                    
    // ==========================================================================
    // 14. АДМИН-ПАНЕЛЬ (ИСПРАВЛЕННАЯ)
    // ==========================================================================
    const adminEditModal = safeGetElement('admin-edit-modal');
    const adminModalClose = safeGetElement('admin-modal-close');
    const adminEditForm = safeGetElement('admin-edit-form');

    if (adminModalClose && adminEditModal) {
        adminModalClose.addEventListener('click', () => adminEditModal.classList.remove('show'));
    }

    async function loadSqlTable() {
        const tableBody = safeGetElement('admin-table-body');
        if (!tableBody) return;

        const activeEmail = localStorage.getItem('active_session_email') || '';

        try {
            const response = await fetch(`api.php?action=get_users&admin_email=${activeEmail}`);
            
            if (response.status === 403) {
                tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #e81123;">Доступ запрещён. Нет прав администратора</td></tr>`;
                return;
            }
            
            const users = await response.json();
            if (!users.length) {
                tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #666;">Нет пользователей</td></tr>`;
                return;
            }

            tableBody.innerHTML = '';
            users.forEach(user => {
                const escapedBio = (user.bio || '-').replace(/[&<>]/g, function(m) {
                    if (m === '&') return '&amp;';
                    if (m === '<') return '&lt;';
                    if (m === '>') return '&gt;';
                    return m;
                });
                
                const tetrisScore = user.tetris_score || 0;
                const checkersWins = user.checkers_wins || 0;
                const checkersLosses = user.checkers_losses || 0;
                
                const rowHTML = `
                    <tr class="admin-row">
                        <td class="admin-id">${user.id}</td>
                        <td class="admin-email">${user.email} ${user.role === 'admin' ? '<span style="color:#107c10;"> </span>' : ''}</td>
                        <td class="admin-phone">${user.phone || '-'}</td>
                        <td class="admin-birth">${user.birth_date || '-'}</td>
                        <td class="admin-lang">${user.prog_lang || '-'}</td>
                        <td class="admin-gender">${user.gender || '-'}</td>
                        <td class="admin-bio-cell">${escapedBio}</td>
                        <td class="stats-cell">
                            <span class="stat-badge">🏆 ${tetrisScore}</span>
                        </td>
                        <td class="stats-cell">
                            <span class="stat-win"> + ${checkersWins}</span>
                            <span class="stat-loss"> - ${checkersLosses}</span>
                        </td>
                        <td class="admin-actions-cell">
                            <button class="admin-edit-btn" 
                                data-id="${user.id}" 
                                data-phone="${(user.phone || '').replace(/&/g, '&amp;')}" 
                                data-date="${user.birth_date || ''}" 
                                data-lang="${user.prog_lang || ''}" 
                                data-gender="${user.gender || ''}" 
                                data-role="${user.role || 'user'}"
                                data-bio="${escapedBio}">Изменить</button>
                            <button class="admin-delete-btn" data-id="${user.id}" ${user.email === activeEmail ? 'disabled style="opacity:0.3; cursor:not-allowed;"' : ''}> Удалить</button>
                        </td>
                    </table>
                `;
                tableBody.insertAdjacentHTML('beforeend', rowHTML);
            });

            // Обработчики кнопок
            document.querySelectorAll('.admin-edit-btn').forEach(btn => {
                btn.removeEventListener('click', adminEditHandler);
                btn.addEventListener('click', adminEditHandler);
            });

            document.querySelectorAll('.admin-delete-btn').forEach(btn => {
                btn.removeEventListener('click', adminDeleteHandler);
                btn.addEventListener('click', adminDeleteHandler);
            });

        } catch (err) {
            tableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #e81123;">Ошибка подключения к серверу</td></tr>`;
        }
    }

    function adminEditHandler(e) {
        const button = e.target;
        
        const editId = safeGetElement('admin-edit-id');
        const editPhone = safeGetElement('admin-edit-phone');
        const editDate = safeGetElement('admin-edit-date');
        const editLang = safeGetElement('admin-edit-lang');
        const editRole = safeGetElement('admin-edit-role');
        const editBio = safeGetElement('admin-edit-bio');
        
        if (editId) editId.value = button.getAttribute('data-id');
        if (editPhone) editPhone.value = button.getAttribute('data-phone');
        if (editDate) editDate.value = button.getAttribute('data-date');
        if (editLang) editLang.value = button.getAttribute('data-lang');
        if (editRole) editRole.value = button.getAttribute('data-role');
        if (editBio) editBio.value = button.getAttribute('data-bio');
        
        const genderVal = button.getAttribute('data-gender');
        const maleRadio = safeGetElement('admin-gender-male');
        const femaleRadio = safeGetElement('admin-gender-female');
        if (genderVal === 'Мужской' && maleRadio) maleRadio.checked = true;
        else if (femaleRadio) femaleRadio.checked = true;

        if (adminEditModal) adminEditModal.classList.add('show');
    }

    async function adminDeleteHandler(e) {
        const id = e.target.getAttribute('data-id');
        const activeEmail = localStorage.getItem('active_session_email') || '';
        
        if (confirm(`Удалить пользователя с ID ${id}?`)) {
            try {
                const delRes = await fetch(`api.php?action=delete_user&id=${id}&admin_email=${activeEmail}`, { method: 'DELETE' });
                const delData = await delRes.json();
                alert(delData.message);
                loadSqlTable();
            } catch (err) { 
                alert('Ошибка при удалении');
            }
        }
    }

    if (adminEditForm) {
        adminEditForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const activeEmail = localStorage.getItem('active_session_email') || '';
            
            const userIdValue = safeGetElement('admin-edit-id');
            const editPhone = safeGetElement('admin-edit-phone');
            const editDate = safeGetElement('admin-edit-date');
            const editLang = safeGetElement('admin-edit-lang');
            const editRole = safeGetElement('admin-edit-role');
            const editBio = safeGetElement('admin-edit-bio');
            const selectedGender = document.querySelector('input[name="admin-gender"]:checked');
            
            if (!userIdValue || !editPhone || !editDate || !editLang || !editRole || !editBio) {
                alert('Ошибка: не все поля формы найдены');
                return;
            }
            
            const updatedData = {
                id: parseInt(userIdValue.value),
                phone: editPhone.value,
                date: editDate.value,
                lang: editLang.value,
                role: editRole.value,
                bio: editBio.value,
                gender: selectedGender ? selectedGender.value : 'Мужской'
            };

            if (isNaN(updatedData.id) || updatedData.id <= 0) {
                alert('Ошибка: неверный ID пользователя');
                return;
            }

            try {
                const response = await fetch(`api.php?action=edit_user&admin_email=${activeEmail}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });

                const data = await response.json();
                
                if (response.ok) {
                    alert('+ ' + data.message);
                    if (adminEditModal) adminEditModal.classList.remove('show');
                    loadSqlTable();
                } else {
                    alert('Ошибка: ' + (data.message || 'Неизвестная ошибка'));
                }
            } catch (err) {
                alert('Ошибка сохранения: ' + err.message);
            }
        });
    }

});
