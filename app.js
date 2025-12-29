// Конфигурация Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCLmI4Ju5vsw3VY8VEvUpwm1g3Cliw_v14",
    authDomain: "mrmeseg-11034.firebaseapp.com",
    databaseURL: "https://mrmeseg-11034-default-rtdb.firebaseio.com",
    projectId: "mrmeseg-11034",
    storageBucket: "mrmeseg-11034.firebasestorage.app",
    messagingSenderId: "704296390245",
    appId: "1:704296390245:web:d6f6d35d3d88d84566c08c"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// Глобальные переменные
let currentUser = null;
let currentUserData = null;
let currentChat = null;
let chats = {};
let allUsers = {};
let isFabOpen = false;

// Переменные для звонков
let localStream = null;
let remoteStream = null;
let peerConnection = null;
let currentCall = null;
let isMuted = false;
let isVideoOff = false;
let callListener = null;

// Переменные для голосовых сообщений
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingTimer = null;
let recordingStartTime = null;

// Переменная для блокировки двойной отправки сообщений
let isSendingMessage = false;

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎄 MrMessage инициализирован!');
    
    initApp();
    setupEventListeners();
    checkNewYear();
    checkMediaSupport();
});

function initApp() {
    // Проверяем авторизацию
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserData(user.uid);
            switchScreen('authScreen', 'chatsScreen');
            showNotification(`Добро пожаловать, ${currentUserData?.username || 'пользователь'}!`, 'success');
        } else {
            currentUser = null;
            currentUserData = null;
            switchScreen('chatsScreen', 'authScreen');
        }
    });
}

function setupEventListeners() {
    // FAB кнопка
    const fabMain = document.getElementById('mainFab');
    if (fabMain) {
        fabMain.addEventListener('click', toggleFabMenu);
    }
    
    // Enter в форме входа
    const loginPassword = document.getElementById('loginPassword');
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') login();
        });
    }
    
    // Обработчик Enter для поля сообщения
    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        // Удаляем старый обработчик если есть
        messageInput.removeEventListener('keypress', handleKeyPress);
        // Добавляем новый обработчик
        messageInput.addEventListener('keypress', handleKeyPress);
    }
    
    // Закрытие модалок по клику вне их
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            hideAllModals();
        }
        
        // Закрытие FAB меню по клику вне
        if (!e.target.closest('.fab-container') && isFabOpen) {
            closeFabMenu();
        }
    });
}

function checkNewYear() {
    const now = new Date();
    const month = now.getMonth();
    const day = now.getDate();
    
    if (month === 11 || (month === 0 && day <= 7)) {
        setTimeout(() => {
            const banner = document.getElementById('newYearBanner');
            if (banner) {
                banner.style.display = 'flex';
            }
        }, 2000);
    }
}

function checkMediaSupport() {
    const supports = {
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        mediaRecorder: !!window.MediaRecorder,
        webRTC: !!window.RTCPeerConnection,
        webSocket: !!window.WebSocket
    };
    
    console.log('Поддержка медиа функций:', supports);
    
    if (!supports.getUserMedia) {
        console.warn('Браузер не поддерживает getUserMedia');
    }
    
    if (!supports.mediaRecorder) {
        console.warn('Браузер не поддерживает MediaRecorder');
    }
    
    return supports;
}

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

function switchScreen(fromId, toId) {
    const fromScreen = document.getElementById(fromId);
    const toScreen = document.getElementById(toId);
    
    if (!fromScreen || !toScreen) return;
    
    fromScreen.classList.remove('active');
    setTimeout(() => {
        fromScreen.style.display = 'none';
        toScreen.style.display = 'block';
        setTimeout(() => {
            toScreen.classList.add('active');
        }, 50);
    }, 300);
    
    const fabContainer = document.getElementById('fabContainer');
    if (toId === 'chatsScreen') {
        fabContainer.style.display = 'block';
        loadChats();
    } else {
        fabContainer.style.display = 'none';
        closeFabMenu();
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type} animate__animated animate__bounceInRight`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    if (!document.querySelector('.notification-styles')) {
        const style = document.createElement('style');
        style.className = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.95);
                padding: 15px 20px;
                border-radius: 12px;
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
                z-index: 10000;
                min-width: 300px;
                max-width: 90%;
                border-left: 5px solid;
                backdrop-filter: blur(10px);
                animation: notificationSlide 0.3s ease;
            }
            @keyframes notificationSlide {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            .notification-success { border-left-color: #2ecc71; }
            .notification-error { border-left-color: #e74c3c; }
            .notification-warning { border-left-color: #f39c12; }
            .notification-info { border-left-color: #3498db; }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            .notification-content i { font-size: 20px; }
            .notification-success .notification-content i { color: #2ecc71; }
            .notification-error .notification-content i { color: #e74c3c; }
            .notification-warning .notification-content i { color: #f39c12; }
            .notification-info .notification-content i { color: #3498db; }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('animate__bounceOutRight');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// ==================== FAB МЕНЮ ====================

function toggleFabMenu() {
    const fabMain = document.getElementById('mainFab');
    const fabMenu = document.querySelector('.fab-menu');
    
    isFabOpen = !isFabOpen;
    fabMain.classList.toggle('active', isFabOpen);
    fabMenu.classList.toggle('active', isFabOpen);
    
    if (isFabOpen) {
        fabMain.innerHTML = '<i class="fas fa-times"></i>';
    } else {
        fabMain.innerHTML = '<i class="fas fa-plus"></i>';
    }
}

function closeFabMenu() {
    isFabOpen = false;
    const fabMain = document.getElementById('mainFab');
    const fabMenu = document.querySelector('.fab-menu');
    
    fabMain.classList.remove('active');
    fabMenu.classList.remove('active');
    fabMain.innerHTML = '<i class="fas fa-plus"></i>';
}

// ==================== МОДАЛЬНЫЕ ОКНА ====================

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modalOverlay');
    
    if (modal && overlay) {
        overlay.style.display = 'block';
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
        
        if (modalId === 'newChatModal') {
            loadUsersForNewChat();
        } else if (modalId === 'newGroupModal') {
            loadUsersForGroup();
        } else if (modalId === 'profileModal') {
            loadProfileData();
        } else if (modalId === 'searchModal') {
            initSearch();
        }
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    const overlay = document.getElementById('modalOverlay');
    
    if (modal) {
        modal.style.display = 'none';
    }
    
    const openModals = document.querySelectorAll('.modal[style*="display: block"]');
    if (openModals.length === 0 && overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function hideAllModals() {
    const modals = document.querySelectorAll('.modal');
    const overlay = document.getElementById('modalOverlay');
    
    modals.forEach(modal => {
        modal.style.display = 'none';
    });
    
    if (overlay) {
        overlay.style.display = 'none';
    }
    
    document.body.style.overflow = '';
    closeFabMenu();
}

// ==================== АВТОРИЗАЦИЯ ====================

async function loadUserData(userId) {
    try {
        const snapshot = await database.ref('users/' + userId).once('value');
        currentUserData = snapshot.val();
        
        if (!currentUserData) {
            currentUserData = {
                username: currentUser.email.split('@')[0],
                email: currentUser.email,
                createdAt: Date.now(),
                status: 'online',
                theme: 'light'
            };
            await database.ref('users/' + userId).set(currentUserData);
        }
        
        await database.ref('users/' + userId + '/status').set('online');
        loadAllUsers();
        setupIncomingCalls();
        
    } catch (error) {
        console.error('Ошибка загрузки данных пользователя:', error);
        showNotification('Ошибка загрузки профиля', 'error');
    }
}

function showLogin() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    clearAuthErrors();
}

function showRegister() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('forgotPasswordForm').style.display = 'none';
    clearAuthErrors();
}

function showForgotPassword() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('forgotPasswordForm').style.display = 'block';
    clearAuthErrors();
}

function clearAuthErrors() {
    document.getElementById('authError').style.display = 'none';
    document.getElementById('regError').style.display = 'none';
    document.getElementById('forgotError').style.display = 'none';
}

function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

async function sendPasswordReset() {
    const email = document.getElementById('forgotEmail').value.trim();
    
    if (!email) {
        showAuthError('Введите ваш email', 'forgotError');
        return;
    }
    
    if (!validateEmail(email)) {
        showAuthError('Введите корректный email', 'forgotError');
        return;
    }
    
    const resetBtn = document.getElementById('resetBtn');
    resetBtn.disabled = true;
    resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Отправка...';
    
    try {
        await auth.sendPasswordResetEmail(email);
        showNotification('Инструкции отправлены на ваш email', 'success');
        setTimeout(() => showLogin(), 3000);
    } catch (error) {
        console.error('Ошибка восстановления пароля:', error);
        let message = 'Ошибка восстановления пароля';
        
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'Пользователь не найден';
                break;
            case 'auth/invalid-email':
                message = 'Неверный формат email';
                break;
        }
        
        showAuthError(message, 'forgotError');
    } finally {
        resetBtn.disabled = false;
        resetBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Восстановить';
    }
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showAuthError('Заполните все поля', 'authError');
        return;
    }
    
    if (!validateEmail(email)) {
        showAuthError('Введите корректный email', 'authError');
        return;
    }
    
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Вход...';
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        showNotification('Успешный вход!', 'success');
    } catch (error) {
        console.error('Ошибка входа:', error);
        let message = 'Ошибка входа';
        
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'Пользователь не найден';
                break;
            case 'auth/wrong-password':
                message = 'Неверный пароль';
                break;
            case 'auth/invalid-email':
                message = 'Неверный формат email';
                break;
            case 'auth/too-many-requests':
                message = 'Слишком много попыток. Попробуйте позже';
                break;
        }
        
        showAuthError(message, 'authError');
    } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Войти';
    }
}

async function register() {
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    
    if (!username || !email || !password || !confirmPassword) {
        showAuthError('Заполните все поля', 'regError');
        return;
    }
    
    if (username.length < 3 || username.length > 20) {
        showAuthError('Имя пользователя должно быть от 3 до 20 символов', 'regError');
        return;
    }
    
    if (!validateEmail(email)) {
        showAuthError('Введите корректный email', 'regError');
        return;
    }
    
    if (password.length < 6) {
        showAuthError('Пароль должен содержать минимум 6 символов', 'regError');
        return;
    }
    
    if (password !== confirmPassword) {
        showAuthError('Пароли не совпадают', 'regError');
        return;
    }
    
    const registerBtn = document.getElementById('registerBtn');
    registerBtn.disabled = true;
    registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Регистрация...';
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        const userData = {
            username: username,
            email: email,
            createdAt: Date.now(),
            status: 'online',
            theme: 'light'
        };
        
        await database.ref('users/' + user.uid).set(userData);
        showNotification('Регистрация успешна!', 'success');
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        let message = 'Ошибка регистрации';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                message = 'Email уже используется';
                break;
            case 'auth/weak-password':
                message = 'Пароль слишком слабый';
                break;
            case 'auth/operation-not-allowed':
                message = 'Регистрация временно недоступна';
                break;
        }
        
        showAuthError(message, 'regError');
    } finally {
        registerBtn.disabled = false;
        registerBtn.innerHTML = '<i class="fas fa-user-plus"></i> Зарегистрироваться';
    }
}

function showAuthError(message, errorId = 'authError') {
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// ==================== ПОЛЬЗОВАТЕЛИ И ЧАТЫ ====================

async function loadAllUsers() {
    try {
        const snapshot = await database.ref('users').once('value');
        allUsers = snapshot.val() || {};
        console.log('Загружено пользователей:', Object.keys(allUsers).length);
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
    }
}

function loadChats() {
    if (!currentUser) return;
    
    const chatsList = document.getElementById('chatsList');
    chatsList.innerHTML = '<div class="loading-chats"><i class="fas fa-spinner fa-spin"></i><p>Загрузка чатов...</p></div>';
    
    database.ref('userChats/' + currentUser.uid).on('value', async (snapshot) => {
        const userChats = snapshot.val() || {};
        chats = {};
        
        if (Object.keys(userChats).length === 0) {
            chatsList.innerHTML = '<div class="empty-state"><i class="fas fa-comments"></i><p>Нет чатов. Создайте первый!</p></div>';
            return;
        }
        
        const chatPromises = Object.keys(userChats).map(async (chatId) => {
            const chatSnapshot = await database.ref('chats/' + chatId).once('value');
            const chatData = chatSnapshot.val();
            if (chatData) {
                chats[chatId] = chatData;
            }
        });
        
        await Promise.all(chatPromises);
        updateChatsList();
    });
}

function updateChatsList() {
    const chatsList = document.getElementById('chatsList');
    let html = '';
    
    const sortedChats = Object.keys(chats).sort((a, b) => {
        return (chats[b].lastMessageTimestamp || 0) - (chats[a].lastMessageTimestamp || 0);
    });
    
    if (sortedChats.length === 0) {
        html = '<div class="empty-state"><i class="fas fa-comments"></i><p>Нет чатов. Создайте первый!</p></div>';
    } else {
        sortedChats.forEach(chatId => {
            const chat = chats[chatId];
            const isGroup = chat.type === 'group';
            
            let chatName, avatarText, avatarColor;
            
            if (isGroup) {
                chatName = chat.name || 'Групповой чат';
                avatarText = '👥';
                avatarColor = '#3498db';
            } else {
                const otherUserId = chat.participants?.find(id => id !== currentUser.uid);
                if (otherUserId && allUsers[otherUserId]) {
                    const user = allUsers[otherUserId];
                    chatName = user.username || 'Пользователь';
                    avatarText = (user.username || 'U').charAt(0).toUpperCase();
                    avatarColor = stringToColor(otherUserId);
                } else {
                    chatName = 'Неизвестный';
                    avatarText = '?';
                    avatarColor = '#95a5a6';
                }
            }
            
            const lastMessage = chat.lastMessage || 'Нет сообщений';
            const lastTime = chat.lastMessageTimestamp ? formatTime(chat.lastMessageTimestamp) : '';
            
            html += `
                <div class="chat-item" onclick="openChat('${chatId}', ${isGroup})">
                    <div class="chat-avatar-small" style="background: ${avatarColor}">
                        ${avatarText}
                    </div>
                    <div class="chat-details">
                        <div class="chat-user-name">${chatName}</div>
                        <div class="chat-user-status">${lastMessage}</div>
                    </div>
                    ${lastTime ? `<div class="chat-time">${lastTime}</div>` : ''}
                </div>
            `;
        });
    }
    
    chatsList.innerHTML = html;
}

function stringToColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
        '#2ecc71', '#3498db', '#9b59b6', '#e74c3c',
        '#f1c40f', '#1abc9c', '#d35400', '#7f8c8d'
    ];
    return colors[Math.abs(hash) % colors.length];
}

function openChat(chatId, isGroup = false) {
    const chat = chats[chatId];
    if (!chat) return;
    
    currentChat = {
        id: chatId,
        type: isGroup ? 'group' : 'private',
        data: chat
    };
    
    if (isGroup) {
        document.getElementById('chatUserName').textContent = chat.name || 'Групповой чат';
        document.getElementById('chatUserStatus').textContent = '● группа';
        document.getElementById('chatAvatar').innerHTML = '👥';
    } else {
        const otherUserId = chat.participants?.find(id => id !== currentUser.uid);
        if (otherUserId && allUsers[otherUserId]) {
            const user = allUsers[otherUserId];
            document.getElementById('chatUserName').textContent = user.username || 'Пользователь';
            document.getElementById('chatUserStatus').textContent = '● ' + (user.status || 'офлайн');
            document.getElementById('chatAvatar').innerHTML = (user.username || 'U').charAt(0).toUpperCase();
            document.getElementById('chatAvatar').style.background = stringToColor(otherUserId);
        }
    }
    
    switchScreen('chatsScreen', 'chatScreen');
    loadMessages(chatId);
}

function showChatsList() {
    switchScreen('chatScreen', 'chatsScreen');
    currentChat = null;
}

function loadMessages(chatId) {
    const messagesContainer = document.getElementById('messagesContainer');
    messagesContainer.innerHTML = '<div class="loading-messages"><i class="fas fa-spinner fa-spin"></i><p>Загрузка сообщений...</p></div>';
    
    database.ref('messages/' + chatId).orderByChild('timestamp').on('value', (snapshot) => {
        const messages = snapshot.val() || {};
        messagesContainer.innerHTML = '';
        
        if (Object.keys(messages).length === 0) {
            messagesContainer.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>Пока нет сообщений</p></div>';
            return;
        }
        
        const sortedMessages = Object.keys(messages)
            .map(key => ({ id: key, ...messages[key] }))
            .sort((a, b) => a.timestamp - b.timestamp);
        
        sortedMessages.forEach(message => {
            displayMessage(message);
        });
        
        scrollToBottom();
    });
}

function displayMessage(message) {
    const messagesContainer = document.getElementById('messagesContainer');
    const isMyMessage = message.senderId === currentUser.uid;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isMyMessage ? 'my-message' : 'other-message'}`;
    
    let content = '';
    
    switch (message.type) {
        case 'image':
            content = `
                <img src="${message.fileData}" 
                     alt="Изображение" 
                     class="message-media"
                     onclick="viewMedia('${message.fileData}', 'image')">
                <div class="message-caption">🖼️ Изображение</div>
            `;
            break;
            
        case 'video':
            content = `
                <video controls class="message-media">
                    <source src="${message.fileData}" type="${message.fileType}">
                    Ваш браузер не поддерживает видео.
                </video>
                <div class="message-caption">🎥 Видео</div>
            `;
            break;
            
        case 'voice':
            content = `
                <div class="voice-message">
                    <button class="play-voice-btn" onclick="playVoiceMessage('${message.audioData}')">
                        <i class="fas fa-play"></i>
                    </button>
                    <div class="voice-wave-small">
                        <div class="wave"></div>
                        <div class="wave"></div>
                        <div class="wave"></div>
                        <div class="wave"></div>
                        <div class="wave"></div>
                    </div>
                    <span class="voice-duration">${formatDuration(message.duration)}</span>
                </div>
            `;
            break;
            
        case 'file':
            content = `
                <div class="file-message">
                    <i class="fas fa-file"></i>
                    <div>
                        <div class="file-name">${message.fileName}</div>
                        <div class="file-size">${formatFileSize(message.fileSize)}</div>
                    </div>
                </div>
            `;
            break;
            
        default:
            content = `<div class="message-text">${message.text || ''}</div>`;
    }
    
    const time = formatTime(message.timestamp);
    
    messageDiv.innerHTML = `
        ${content}
        <div class="message-time">${time}</div>
    `;
    
    messagesContainer.appendChild(messageDiv);
}

// ==================== ОТПРАВКА СООБЩЕНИЙ (ИСПРАВЛЕННАЯ) ====================

async function sendMessage() {
    // Проверяем, не идет ли уже отправка
    if (isSendingMessage) {
        console.log('Сообщение уже отправляется...');
        return;
    }
    
    if (!currentChat || !currentUser) {
        showNotification('Выберите чат для отправки сообщения', 'warning');
        return;
    }
    
    const messageInput = document.getElementById('messageInput');
    const text = messageInput.value.trim();
    
    if (!text) return;
    
    // Блокируем отправку
    isSendingMessage = true;
    
    // Блокируем кнопку отправки
    const sendBtn = document.querySelector('.send-btn');
    const originalBtnContent = sendBtn ? sendBtn.innerHTML : '';
    if (sendBtn) {
        sendBtn.disabled = true;
        sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    }
    
    const messageData = {
        senderId: currentUser.uid,
        text: text,
        timestamp: Date.now(),
        type: 'text'
    };
    
    try {
        const messageRef = database.ref('messages/' + currentChat.id).push();
        await messageRef.set(messageData);
        
        await database.ref('chats/' + currentChat.id).update({
            lastMessage: text.length > 30 ? text.substring(0, 30) + '...' : text,
            lastMessageTimestamp: Date.now()
        });
        
        // Очищаем поле ввода
        messageInput.value = '';
        scrollToBottom();
        
        showNotification('Сообщение отправлено', 'success');
        
    } catch (error) {
        console.error('Ошибка отправки сообщения:', error);
        showNotification('Ошибка отправки сообщения', 'error');
    } finally {
        // Разблокируем кнопку
        if (sendBtn) {
            sendBtn.disabled = false;
            sendBtn.innerHTML = originalBtnContent;
        }
        
        // Разблокируем отправку через 500ms
        setTimeout(() => {
            isSendingMessage = false;
        }, 500);
    }
}

function handleKeyPress(event) {
    // Если нажат Enter без Shift
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        event.stopPropagation();
        
        // Маленькая задержка для предотвращения двойного срабатывания
        setTimeout(() => {
            sendMessage();
        }, 10);
        
        return false;
    }
}

function scrollToBottom() {
    const messagesContainer = document.getElementById('messagesContainer');
    setTimeout(() => {
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }, 100);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
}

// ==================== НОВЫЙ ЧАТ ====================

async function loadUsersForNewChat() {
    const searchResults = document.getElementById('searchResults');
    searchResults.innerHTML = '<div class="loading">Загрузка пользователей...</div>';
    
    try {
        const snapshot = await database.ref('users').once('value');
        const users = snapshot.val() || {};
        
        let html = '';
        Object.keys(users).forEach(userId => {
            if (userId !== currentUser.uid) {
                const user = users[userId];
                html += `
                    <div class="user-item" onclick="createPrivateChat('${userId}')">
                        <div class="user-avatar">${(user.username || 'U').charAt(0).toUpperCase()}</div>
                        <div class="user-info">
                            <div class="user-name">${user.username || 'Пользователь'}</div>
                            <div class="user-status">${user.status || 'офлайн'}</div>
                        </div>
                    </div>
                `;
            }
        });
        
        if (!html) {
            html = '<div class="empty-state">Нет других пользователей</div>';
        }
        
        searchResults.innerHTML = html;
        
    } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
        searchResults.innerHTML = '<div class="error">Ошибка загрузки</div>';
    }
}

async function createPrivateChat(otherUserId) {
    try {
        const chatId = [currentUser.uid, otherUserId].sort().join('_');
        
        const existingChat = await database.ref('chats/' + chatId).once('value');
        
        if (existingChat.exists()) {
            openChat(chatId, false);
            hideModal('newChatModal');
            return;
        }
        
        const chatData = {
            participants: [currentUser.uid, otherUserId],
            createdAt: Date.now(),
            lastMessage: '',
            lastMessageTimestamp: Date.now(),
            type: 'private'
        };
        
        await database.ref('chats/' + chatId).set(chatData);
        
        await database.ref('userChats/' + currentUser.uid + '/' + chatId).set(true);
        await database.ref('userChats/' + otherUserId + '/' + chatId).set(true);
        
        hideModal('newChatModal');
        openChat(chatId, false);
        showNotification('Чат создан!', 'success');
        
    } catch (error) {
        console.error('Ошибка создания чата:', error);
        showNotification('Ошибка создания чата', 'error');
    }
}

// ==================== ПОИСК ====================

function filterChats() {
    const query = document.getElementById('searchChats').value.toLowerCase();
    const chatItems = document.querySelectorAll('.chat-item');
    
    chatItems.forEach(item => {
        const chatName = item.querySelector('.chat-user-name').textContent.toLowerCase();
        const lastMessage = item.querySelector('.chat-user-status').textContent.toLowerCase();
        
        if (chatName.includes(query) || lastMessage.includes(query)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function clearSearch() {
    document.getElementById('searchChats').value = '';
    filterChats();
}

function initSearch() {
    const searchInput = document.getElementById('globalSearch');
    if (searchInput) {
        searchInput.value = '';
        searchInput.addEventListener('input', debounce(performSearch, 300));
    }
}

function performSearch() {
    const query = document.getElementById('globalSearch').value.toLowerCase();
    const resultsDiv = document.getElementById('searchResultsContainer');
    
    if (!query) {
        resultsDiv.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Введите запрос для поиска</p></div>';
        return;
    }
    
    resultsDiv.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Поиск...</div>';
    
    setTimeout(() => {
        let html = '';
        
        // Поиск по чатам
        Object.keys(chats).forEach(chatId => {
            const chat = chats[chatId];
            const isGroup = chat.type === 'group';
            let chatName = '';
            
            if (isGroup) {
                chatName = chat.name || 'Групповой чат';
            } else {
                const otherUserId = chat.participants?.find(id => id !== currentUser.uid);
                if (otherUserId && allUsers[otherUserId]) {
                    chatName = allUsers[otherUserId].username || 'Пользователь';
                }
            }
            
            if (chatName.toLowerCase().includes(query)) {
                html += `
                    <div class="search-result-item" onclick="openChat('${chatId}', ${isGroup}); hideModal('searchModal')">
                        <div class="search-result-avatar">${isGroup ? '👥' : '👤'}</div>
                        <div class="search-result-info">
                            <div class="search-result-title">${chatName}</div>
                            <div class="search-result-subtitle">${chat.lastMessage || 'Нет сообщений'}</div>
                        </div>
                    </div>
                `;
            }
        });
        
        // Поиск по пользователям
        Object.keys(allUsers).forEach(userId => {
            if (userId !== currentUser.uid) {
                const user = allUsers[userId];
                if (user.username && user.username.toLowerCase().includes(query)) {
                    html += `
                        <div class="search-result-item" onclick="createPrivateChat('${userId}'); hideModal('searchModal')">
                            <div class="search-result-avatar">${(user.username || 'U').charAt(0).toUpperCase()}</div>
                            <div class="search-result-info">
                                <div class="search-result-title">${user.username}</div>
                                <div class="search-result-subtitle">${user.status || 'офлайн'}</div>
                            </div>
                        </div>
                    `;
                }
            }
        });
        
        if (!html) {
            html = '<div class="empty-state"><i class="fas fa-search"></i><p>Ничего не найдено</p></div>';
        }
        
        resultsDiv.innerHTML = html;
    }, 500);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ==================== ЗВОНКИ ====================

async function startVoiceCall() {
    if (!currentChat || !currentUser) {
        showNotification('Выберите чат для звонка', 'warning');
        return;
    }
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        
        let callerName = '';
        let toUserId = '';
        
        if (currentChat.type === 'private') {
            const otherUserId = currentChat.data.participants?.find(id => id !== currentUser.uid);
            if (otherUserId && allUsers[otherUserId]) {
                toUserId = otherUserId;
                callerName = allUsers[otherUserId].username || 'Пользователь';
            }
        } else {
            toUserId = currentChat.id;
            callerName = currentChat.data.name || 'Групповой чат';
        }
        
        if (!toUserId) {
            showNotification('Не удалось определить собеседника', 'error');
            return;
        }
        
        const callData = {
            callerId: currentUser.uid,
            callerName: currentUserData.username || 'Пользователь',
            to: toUserId,
            chatId: currentChat.id,
            type: 'voice',
            timestamp: Date.now(),
            status: 'calling',
            isGroupCall: currentChat.type === 'group'
        };
        
        const callRef = database.ref('calls').push();
        await callRef.set(callData);
        currentCall = {
            id: callRef.key,
            ...callData,
            localStream: localStream
        };
        
        showCallScreen('outgoing', callerName);
        monitorCallResponse(callRef.key);
        
        setTimeout(() => {
            if (currentCall && currentCall.status === 'calling') {
                showNotification('Звонок не был принят', 'warning');
                endCall();
            }
        }, 45000);
        
    } catch (error) {
        console.error('Ошибка запуска звонка:', error);
        
        if (error.name === 'NotAllowedError') {
            showNotification('Разрешите доступ к микрофону', 'error');
        } else if (error.name === 'NotFoundError') {
            showNotification('Микрофон не найден', 'error');
        } else {
            showNotification('Ошибка запуска звонка: ' + error.message, 'error');
        }
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
    }
}

async function startVideoCall() {
    if (!currentChat || !currentUser) {
        showNotification('Выберите чат для видеозвонка', 'warning');
        return;
    }
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user'
            }
        });
        
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = localStream;
            localVideo.play().catch(e => console.log('Ошибка воспроизведения:', e));
        }
        
        let callerName = '';
        let toUserId = '';
        
        if (currentChat.type === 'private') {
            const otherUserId = currentChat.data.participants?.find(id => id !== currentUser.uid);
            if (otherUserId && allUsers[otherUserId]) {
                toUserId = otherUserId;
                callerName = allUsers[otherUserId].username || 'Пользователь';
            }
        } else {
            toUserId = currentChat.id;
            callerName = currentChat.data.name || 'Групповой чат';
        }
        
        if (!toUserId) {
            showNotification('Не удалось определить собеседника', 'error');
            return;
        }
        
        const callData = {
            callerId: currentUser.uid,
            callerName: currentUserData.username || 'Пользователь',
            to: toUserId,
            chatId: currentChat.id,
            type: 'video',
            timestamp: Date.now(),
            status: 'calling',
            isGroupCall: currentChat.type === 'group'
        };
        
        const callRef = database.ref('calls').push();
        await callRef.set(callData);
        currentCall = {
            id: callRef.key,
            ...callData,
            localStream: localStream
        };
        
        showCallScreen('outgoing', callerName);
        monitorCallResponse(callRef.key);
        
        setTimeout(() => {
            if (currentCall && currentCall.status === 'calling') {
                showNotification('Звонок не был принят', 'warning');
                endCall();
            }
        }, 45000);
        
    } catch (error) {
        console.error('Ошибка запуска видеозвонка:', error);
        
        if (error.name === 'NotAllowedError') {
            showNotification('Разрешите доступ к камере и микрофону', 'error');
        } else if (error.name === 'NotFoundError') {
            showNotification('Камера не найдена', 'error');
        } else {
            showNotification('Ошибка запуска видеозвонка: ' + error.message, 'error');
        }
        
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
    }
}

function setupIncomingCalls() {
    if (!currentUser) return;
    
    if (callListener) {
        callListener.off();
    }
    
    callListener = database.ref('calls')
        .orderByChild('to')
        .equalTo(currentUser.uid)
        .on('child_added', (snapshot) => {
            const callData = snapshot.val();
            
            if (callData.status === 'calling' && !currentCall) {
                showIncomingCall(callData, snapshot.key);
            }
        });
}

function showIncomingCall(callData, callId) {
    const popupHTML = `
        <div class="incoming-call-popup animate__animated animate__bounceIn">
            <div class="caller-info">
                <div class="caller-avatar">
                    ${(callData.callerName || '?').charAt(0).toUpperCase()}
                </div>
                <div class="caller-details">
                    <div class="caller-name">${callData.callerName || 'Неизвестный'}</div>
                    <div class="call-type">
                        <i class="fas ${callData.type === 'video' ? 'fa-video' : 'fa-phone'}"></i>
                        ${callData.type === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
                    </div>
                </div>
            </div>
            <div class="call-buttons">
                <button class="call-btn accept-btn" onclick="acceptIncomingCall('${callId}')">
                    <i class="fas fa-phone"></i>
                </button>
                <button class="call-btn reject-btn" onclick="rejectIncomingCall('${callId}')">
                    <i class="fas fa-phone-slash"></i>
                </button>
            </div>
        </div>
    `;
    
    const oldPopup = document.querySelector('.incoming-call-popup-container');
    if (oldPopup) oldPopup.remove();
    
    const popupContainer = document.createElement('div');
    popupContainer.className = 'incoming-call-popup-container';
    popupContainer.innerHTML = popupHTML;
    document.body.appendChild(popupContainer);
    
    addIncomingCallStyles();
    
    setTimeout(() => {
        if (popupContainer.parentNode) {
            rejectIncomingCall(callId);
            popupContainer.remove();
        }
    }, 30000);
}

function addIncomingCallStyles() {
    if (!document.querySelector('#incoming-call-styles')) {
        const styles = `
            .incoming-call-popup-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                animation: slideInRight 0.3s ease;
            }
            
            .incoming-call-popup {
                background: white;
                border-radius: 20px;
                padding: 20px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                min-width: 300px;
                border: 3px solid var(--primary-color);
            }
            
            .caller-info {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 20px;
            }
            
            .caller-avatar {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(45deg, var(--primary-color), var(--secondary-color));
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                font-weight: bold;
            }
            
            .caller-details {
                flex: 1;
            }
            
            .caller-name {
                font-weight: 600;
                font-size: 18px;
                color: #333;
                margin-bottom: 5px;
            }
            
            .call-type {
                color: #666;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 14px;
            }
            
            .call-buttons {
                display: flex;
                gap: 20px;
                justify-content: center;
            }
            
            .call-btn {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                border: none;
                font-size: 24px;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .accept-btn {
                background: #2ecc71;
                color: white;
            }
            
            .reject-btn {
                background: #e74c3c;
                color: white;
            }
            
            .call-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            }
            
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.id = 'incoming-call-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
}

async function acceptIncomingCall(callId) {
    try {
        await database.ref(`calls/${callId}`).update({
            status: 'accepted',
            acceptedAt: Date.now()
        });
        
        const callSnapshot = await database.ref(`calls/${callId}`).once('value');
        const callData = callSnapshot.val();
        
        const mediaConstraints = {
            audio: true,
            video: callData.type === 'video'
        };
        
        localStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        
        if (callData.type === 'video') {
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localStream;
                localVideo.play().catch(e => console.log('Ошибка воспроизведения:', e));
            }
        }
        
        currentCall = {
            id: callId,
            ...callData,
            localStream: localStream
        };
        
        showCallScreen('incoming', callData.callerName);
        
        const popup = document.querySelector('.incoming-call-popup-container');
        if (popup) popup.remove();
        
        startCallTimer();
        
    } catch (error) {
        console.error('Ошибка принятия звонка:', error);
        showNotification('Не удалось принять звонок', 'error');
        rejectIncomingCall(callId);
    }
}

function rejectIncomingCall(callId) {
    if (callId) {
        database.ref(`calls/${callId}`).update({
            status: 'rejected',
            rejectedAt: Date.now(),
            endedBy: currentUser?.uid || 'system'
        });
    }
    
    const popup = document.querySelector('.incoming-call-popup-container');
    if (popup) popup.remove();
}

function monitorCallResponse(callId) {
    const callRef = database.ref(`calls/${callId}`);
    
    callRef.on('value', (snapshot) => {
        const callData = snapshot.val();
        if (!callData) return;
        
        switch (callData.status) {
            case 'accepted':
                handleCallAccepted(callData);
                break;
                
            case 'rejected':
                showNotification('Звонок отклонен', 'warning');
                endCall();
                break;
                
            case 'ended':
                if (callData.endedBy !== currentUser.uid) {
                    showNotification('Собеседник завершил звонок', 'info');
                }
                endCall();
                break;
        }
    });
}

function handleCallAccepted(callData) {
    if (!currentCall) return;
    
    currentCall.status = 'accepted';
    document.getElementById('callStatus').textContent = 'Соединение установлено';
    
    showNotification('Звонок принят!', 'success');
    startCallTimer();
}

function startCallTimer() {
    let seconds = 0;
    const timerElement = document.getElementById('callStatus');
    
    const timer = setInterval(() => {
        if (!currentCall || currentCall.status !== 'accepted') {
            clearInterval(timer);
            return;
        }
        
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }, 1000);
}

function showCallScreen(type, userName) {
    document.getElementById('callScreen').style.display = 'flex';
    document.getElementById('callUserName').textContent = userName || 'Собеседник';
    
    if (type === 'outgoing') {
        document.getElementById('callStatus').textContent = 'Вызываем...';
    } else {
        document.getElementById('callStatus').textContent = 'Входящий звонок...';
    }
    
    document.querySelectorAll('.screen').forEach(screen => {
        if (screen.id !== 'callScreen') {
            screen.style.display = 'none';
        }
    });
    
    document.getElementById('fabContainer').style.display = 'none';
}

function toggleMute() {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length > 0) {
        audioTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        
        isMuted = !isMuted;
        const muteBtn = document.querySelector('.mute-btn');
        if (muteBtn) {
            muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
            muteBtn.style.background = isMuted ? '#dc3545' : '#6c757d';
        }
        
        showNotification(isMuted ? 'Микрофон выключен' : 'Микрофон включен', 'info');
    }
}

function toggleVideo() {
    if (!localStream) return;
    
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length > 0) {
        videoTracks.forEach(track => {
            track.enabled = !track.enabled;
        });
        
        isVideoOff = !isVideoOff;
        const videoBtn = document.querySelector('.video-btn');
        if (videoBtn) {
            videoBtn.innerHTML = isVideoOff ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
            videoBtn.style.background = isVideoOff ? '#dc3545' : '#17a2b8';
        }
        
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.style.opacity = isVideoOff ? '0.3' : '1';
        }
    }
}

async function endCall() {
    try {
        if (currentCall && currentCall.id) {
            await database.ref(`calls/${currentCall.id}`).update({
                status: 'ended',
                endedAt: Date.now(),
                endedBy: currentUser?.uid || 'system',
                duration: currentCall.acceptedAt ? Date.now() - currentCall.acceptedAt : 0
            });
        }
        
        if (localStream) {
            localStream.getTracks().forEach(track => {
                track.stop();
            });
            localStream = null;
        }
        
        if (remoteStream) {
            remoteStream.getTracks().forEach(track => track.stop());
            remoteStream = null;
        }
        
        isMuted = false;
        isVideoOff = false;
        
        document.getElementById('callScreen').style.display = 'none';
        
        if (currentChat) {
            document.getElementById('chatScreen').style.display = 'flex';
        } else {
            document.getElementById('chatsScreen').style.display = 'flex';
        }
        
        document.getElementById('fabContainer').style.display = 'block';
        
        const popup = document.querySelector('.incoming-call-popup-container');
        if (popup) popup.remove();
        
        currentCall = null;
        
    } catch (error) {
        console.error('Ошибка завершения звонка:', error);
    }
}

// ==================== ГОЛОСОВЫЕ СООБЩЕНИЯ ====================

async function toggleVoiceRecording() {
    if (isRecording) {
        stopVoiceRecording();
    } else {
        await startVoiceRecording();
    }
}

async function startVoiceRecording() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showNotification('Ваш браузер не поддерживает запись голоса', 'error');
            return;
        }
        
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            
            const reader = new FileReader();
            reader.onload = async (e) => {
                const base64Audio = e.target.result;
                
                try {
                    await sendVoiceMessage(base64Audio, audioBlob.size);
                    
                } catch (error) {
                    console.error('Ошибка отправки голосового сообщения:', error);
                    showNotification('Ошибка отправки голосового сообщения', 'error');
                }
            };
            reader.readAsDataURL(audioBlob);
            
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start(100);
        isRecording = true;
        
        document.querySelector('.voice-btn').classList.add('recording');
        document.getElementById('voiceRecorder').style.display = 'block';
        
        recordingStartTime = Date.now();
        recordingTimer = setInterval(updateRecordingTimer, 1000);
        updateRecordingTimer();
        
        setTimeout(() => {
            if (isRecording) {
                stopVoiceRecording();
            }
        }, 120000);
        
    } catch (error) {
        console.error('Ошибка записи голоса:', error);
        
        if (error.name === 'NotAllowedError') {
            showNotification('Разрешите доступ к микрофону', 'error');
        } else if (error.name === 'NotFoundError') {
            showNotification('Микрофон не найден', 'error');
        } else {
            showNotification('Ошибка записи голоса: ' + error.message, 'error');
        }
    }
}

function stopVoiceRecording() {
    if (mediaRecorder && isRecording) {
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        cleanupRecording();
    }
}

function cancelVoiceRecording() {
    if (mediaRecorder && isRecording) {
        if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        }
        cleanupRecording();
        audioChunks = [];
        showNotification('Запись отменена', 'info');
    }
}

function cleanupRecording() {
    isRecording = false;
    
    const voiceBtn = document.querySelector('.voice-btn');
    if (voiceBtn) {
        voiceBtn.classList.remove('recording');
    }
    
    document.getElementById('voiceRecorder').style.display = 'none';
    
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    
    recordingStartTime = null;
}

function updateRecordingTimer() {
    if (!recordingStartTime) return;
    
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    
    const timerElement = document.getElementById('voiceTimer');
    if (timerElement) {
        timerElement.textContent = `${minutes}:${seconds}`;
    }
    
    const waveBars = document.querySelectorAll('.wave-bar');
    waveBars.forEach((bar, index) => {
        const height = 20 + Math.random() * 80;
        bar.style.height = `${height}%`;
        bar.style.animationDelay = `${index * 0.1}s`;
    });
}

async function sendVoiceMessage(audioData, duration) {
    if (!currentChat || !currentUser) {
        showNotification('Выберите чат для отправки', 'warning');
        return;
    }
    
    const messageData = {
        senderId: currentUser.uid,
        type: 'voice',
        audioData: audioData,
        duration: duration,
        timestamp: Date.now()
    };
    
    try {
        const messageRef = database.ref('messages/' + currentChat.id).push();
        await messageRef.set(messageData);
        
        await database.ref('chats/' + currentChat.id).update({
            lastMessage: '🎤 Голосовое сообщение',
            lastMessageTimestamp: Date.now()
        });
        
        showNotification('Голосовое сообщение отправлено!', 'success');
        
    } catch (error) {
        console.error('Ошибка отправки голосового сообщения:', error);
        showNotification('Ошибка отправки голосового сообщения', 'error');
        throw error;
    }
}

// ==================== ОТПРАВКА ФАЙЛОВ ====================

function showAttachMenu() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*,video/*';
    fileInput.multiple = false;
    fileInput.style.display = 'none';
    
    fileInput.onchange = async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            await handleFileUpload(file);
        }
        
        document.body.removeChild(fileInput);
    };
    
    document.body.appendChild(fileInput);
    fileInput.click();
}

async function handleFileUpload(file) {
    if (!currentChat || !currentUser) {
        showNotification('Выберите чат для отправки файла', 'warning');
        return;
    }
    
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    if (!isImage && !isVideo) {
        showNotification('Пожалуйста, выберите изображение или видео', 'error');
        return;
    }
    
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
        showNotification('Файл слишком большой. Максимальный размер: 5MB', 'error');
        return;
    }
    
    try {
        showNotification('Загрузка файла...', 'info');
        
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const base64Data = e.target.result;
                
                const messageData = {
                    senderId: currentUser.uid,
                    type: isImage ? 'image' : 'video',
                    fileData: base64Data,
                    fileName: file.name,
                    fileSize: file.size,
                    fileType: file.type,
                    timestamp: Date.now()
                };
                
                const messageRef = database.ref('messages/' + currentChat.id).push();
                await messageRef.set(messageData);
                
                await database.ref('chats/' + currentChat.id).update({
                    lastMessage: isImage ? '🖼️ Изображение' : '🎥 Видео',
                    lastMessageTimestamp: Date.now()
                });
                
                showNotification('Файл успешно отправлен!', 'success');
                
            } catch (error) {
                console.error('Ошибка обработки файла:', error);
                showNotification('Ошибка обработки файла', 'error');
            }
        };
        
        reader.onerror = () => {
            showNotification('Ошибка чтения файла', 'error');
        };
        
        reader.readAsDataURL(file);
        
    } catch (error) {
        console.error('Ошибка загрузки файла:', error);
        showNotification('Ошибка загрузки файла: ' + error.message, 'error');
    }
}

// ==================== МЕДИА ФУНКЦИИ ====================

function playVoiceMessage(audioData) {
    const voicePlayer = document.getElementById('voicePlayer');
    voicePlayer.src = audioData;
    voicePlayer.play().catch(e => {
        console.error('Ошибка воспроизведения:', e);
        showNotification('Ошибка воспроизведения голосового сообщения', 'error');
    });
}

function viewMedia(src, type) {
    const modalHTML = `
        <div class="media-viewer-modal">
            <div class="media-viewer-content">
                <button class="close-viewer" onclick="closeMediaViewer()">×</button>
                ${type === 'image' 
                    ? `<img src="${src}" alt="Изображение" class="full-media">`
                    : `<video controls autoplay class="full-media">
                         <source src="${src}" type="video/mp4">
                       </video>`
                }
                <div class="media-actions">
                    <button onclick="downloadMedia('${src}', '${type}')">
                        <i class="fas fa-download"></i> Скачать
                    </button>
                </div>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.innerHTML = modalHTML;
    document.body.appendChild(modal.firstChild);
    
    addMediaViewerStyles();
}

function closeMediaViewer() {
    const viewer = document.querySelector('.media-viewer-modal');
    if (viewer) {
        viewer.remove();
    }
}

function downloadMedia(src, type) {
    const link = document.createElement('a');
    link.href = src;
    link.download = `mrmessage_${Date.now()}.${type === 'image' ? 'jpg' : 'mp4'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function addMediaViewerStyles() {
    if (!document.querySelector('#media-viewer-styles')) {
        const styles = `
            .media-viewer-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.9);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            }
            
            .media-viewer-content {
                position: relative;
                max-width: 90%;
                max-height: 90%;
            }
            
            .full-media {
                max-width: 100%;
                max-height: 80vh;
                border-radius: 10px;
            }
            
            .close-viewer {
                position: absolute;
                top: -40px;
                right: 0;
                background: none;
                border: none;
                color: white;
                font-size: 30px;
                cursor: pointer;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .media-actions {
                position: absolute;
                bottom: -50px;
                left: 0;
                right: 0;
                display: flex;
                justify-content: center;
                gap: 20px;
            }
            
            .media-actions button {
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.id = 'media-viewer-styles';
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
}

// ==================== ПРОФИЛЬ ====================

function loadProfileData() {
    if (!currentUserData) return;
    
    document.getElementById('profileUsername').value = currentUserData.username || '';
    document.getElementById('profileEmail').value = currentUserData.email || '';
    
    const avatarPreview = document.getElementById('avatarPreview');
    if (currentUserData.avatar) {
        avatarPreview.style.backgroundImage = `url('${currentUserData.avatar}')`;
        avatarPreview.innerHTML = '';
    } else {
        avatarPreview.style.backgroundImage = '';
        avatarPreview.innerHTML = '<i class="fas fa-user"></i>';
    }
}

async function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showNotification('Изображение слишком большое. Максимальный размер: 2MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
        try {
            const base64Data = e.target.result;
            
            await database.ref('users/' + currentUser.uid + '/avatar').set(base64Data);
            currentUserData.avatar = base64Data;
            
            const avatarPreview = document.getElementById('avatarPreview');
            avatarPreview.style.backgroundImage = `url('${base64Data}')`;
            avatarPreview.innerHTML = '';
            
            showNotification('Аватар обновлен!', 'success');
            
        } catch (error) {
            console.error('Ошибка загрузки аватара:', error);
            showNotification('Ошибка загрузки аватара', 'error');
        }
    };
    
    reader.onerror = () => {
        showNotification('Ошибка чтения файла', 'error');
    };
    
    reader.readAsDataURL(file);
}

async function updateProfile() {
    const newUsername = document.getElementById('profileUsername').value.trim();
    if (!newUsername) {
        showNotification('Введите имя пользователя', 'warning');
        return;
    }
    
    if (newUsername.length < 3 || newUsername.length > 20) {
        showNotification('Имя пользователя должно быть от 3 до 20 символов', 'warning');
        return;
    }
    
    try {
        await database.ref('users/' + currentUser.uid + '/username').set(newUsername);
        currentUserData.username = newUsername;
        
        showNotification('Профиль обновлен!', 'success');
        hideModal('profileModal');
        loadChats();
        
    } catch (error) {
        console.error('Ошибка обновления профиля:', error);
        showNotification('Ошибка обновления профиля', 'error');
    }
}

// ==================== ВЫХОД ====================

async function logout() {
    try {
        if (currentUser) {
            await database.ref('users/' + currentUser.uid + '/status').set('offline');
            
            if (currentCall) {
                await endCall();
            }
            
            if (callListener) {
                callListener.off();
                callListener = null;
            }
        }
        
        await auth.signOut();
        showNotification('Вы вышли из системы', 'info');
        
    } catch (error) {
        console.error('Ошибка выхода:', error);
        showNotification('Ошибка при выходе', 'error');
    }
}

// ==================== ГРУППЫ ====================

function loadUsersForGroup() {
    const membersList = document.getElementById('groupMembersList');
    let html = '';
    
    Object.keys(allUsers).forEach(userId => {
        if (userId !== currentUser.uid) {
            const user = allUsers[userId];
            html += `
                <div class="group-member-item" onclick="toggleGroupMember('${userId}', this)">
                    <div class="member-avatar">${(user.username || 'U').charAt(0).toUpperCase()}</div>
                    <div class="member-name">${user.username || 'Пользователь'}</div>
                    <div class="member-checkbox">□</div>
                </div>
            `;
        }
    });
    
    if (!html) {
        html = '<div class="empty-state">Нет других пользователей</div>';
    }
    
    membersList.innerHTML = html;
}

let selectedGroupMembers = new Set();

function toggleGroupMember(userId, element) {
    if (selectedGroupMembers.has(userId)) {
        selectedGroupMembers.delete(userId);
        element.classList.remove('selected');
        element.querySelector('.member-checkbox').textContent = '□';
    } else {
        selectedGroupMembers.add(userId);
        element.classList.add('selected');
        element.querySelector('.member-checkbox').textContent = '✓';
    }
}

function previewGroupAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showNotification('Изображение слишком большое. Максимальный размер: 2MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const avatarPreview = document.getElementById('groupAvatarPreview');
        avatarPreview.style.backgroundImage = `url('${e.target.result}')`;
        avatarPreview.innerHTML = '';
        avatarPreview.dataset.avatar = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function createGroup() {
    const groupName = document.getElementById('groupName').value.trim();
    if (!groupName) {
        showNotification('Введите название группы', 'warning');
        return;
    }
    
    if (selectedGroupMembers.size === 0) {
        showNotification('Выберите участников группы', 'warning');
        return;
    }
    
    try {
        const groupId = 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const participants = Array.from(selectedGroupMembers);
        participants.push(currentUser.uid);
        
        const avatarPreview = document.getElementById('groupAvatarPreview');
        const avatarData = avatarPreview.dataset.avatar || '';
        
        const groupData = {
            name: groupName,
            type: 'group',
            participants: participants,
            createdBy: currentUser.uid,
            createdAt: Date.now(),
            lastMessage: 'Группа создана',
            lastMessageTimestamp: Date.now(),
            avatar: avatarData
        };
        
        await database.ref('chats/' + groupId).set(groupData);
        
        for (const userId of participants) {
            await database.ref('userChats/' + userId + '/' + groupId).set(true);
        }
        
        hideModal('newGroupModal');
        selectedGroupMembers.clear();
        
        showNotification('Группа создана!', 'success');
        
        setTimeout(() => {
            openChat(groupId, true);
        }, 500);
        
    } catch (error) {
        console.error('Ошибка создания группы:', error);
        showNotification('Ошибка создания группы', 'error');
    }
}

// ==================== ТЕМЫ ====================

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
    
    if (currentUser) {
        database.ref('users/' + currentUser.uid + '/theme').set(newTheme);
    }
    
    showNotification(`Тема изменена на ${newTheme === 'dark' ? 'темную' : 'светлую'}`, 'info');
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    
    if (theme === 'dark') {
        document.documentElement.style.setProperty('--bg-color', '#1a1a2e');
        document.documentElement.style.setProperty('--text-color', '#ffffff');
    } else {
        document.documentElement.style.setProperty('--bg-color', '#ffffff');
        document.documentElement.style.setProperty('--text-color', '#333333');
    }
}

// ==================== ЭКСПОРТ ФУНКЦИЙ ====================

window.switchScreen = switchScreen;
window.showNotification = showNotification;
window.toggleFabMenu = toggleFabMenu;
window.showModal = showModal;
window.hideModal = hideModal;
window.showLogin = showLogin;
window.showRegister = showRegister;
window.showForgotPassword = showForgotPassword;
window.login = login;
window.register = register;
window.logout = logout;
window.openChat = openChat;
window.showChatsList = showChatsList;
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.filterChats = filterChats;
window.clearSearch = clearSearch;
window.createPrivateChat = createPrivateChat;
window.showNewChatModal = () => showModal('newChatModal');
window.showNewGroupModal = () => showModal('newGroupModal');
window.showSearchModal = () => showModal('searchModal');
window.showProfileModal = () => showModal('profileModal');
window.startVoiceCall = startVoiceCall;
window.startVideoCall = startVideoCall;
window.toggleVoiceRecording = toggleVoiceRecording;
window.stopVoiceRecording = stopVoiceRecording;
window.cancelVoiceRecording = cancelVoiceRecording;
window.showAttachMenu = showAttachMenu;
window.acceptIncomingCall = acceptIncomingCall;
window.rejectIncomingCall = rejectIncomingCall;
window.toggleMute = toggleMute;
window.toggleVideo = toggleVideo;
window.endCall = endCall;
window.playVoiceMessage = playVoiceMessage;
window.viewMedia = viewMedia;
window.closeMediaViewer = closeMediaViewer;
window.downloadMedia = downloadMedia;
window.updateProfile = updateProfile;
window.uploadAvatar = uploadAvatar;
window.toggleTheme = toggleTheme;
window.toggleGroupMember = toggleGroupMember;
window.previewGroupAvatar = previewGroupAvatar;
window.createGroup = createGroup;

console.log('✅ MrMessage полностью загружен и готов к работе!');