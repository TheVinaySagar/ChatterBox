const socket = io();
const chatForm = document.getElementById('chat-form');
const chatMessages = document.getElementById('chat-messages');
const roomName = document.getElementById('room-name');
const userList = document.getElementById('users');
const userCount = document.getElementById('user-count');
const messageInput = document.getElementById('msg');
const sendButton = document.getElementById('send-button');
const emojiButton = document.getElementById('emoji-button');
const emojiPicker = document.getElementById('emoji-picker');
const themeToggle = document.getElementById('theme-toggle');
const typingStatus = document.getElementById('typing-status');

// Get username and room from URL
const { username, room } = Qs.parse(location.search, { ignoreQueryPrefix: true });

// Current user info
let currentUser = username;
let isTyping = false;
let typingTimeout;

// Popular emojis
const popularEmojis = [
    '😀', '😂', '😍', '🥰', '😊', '😎', '🤔', '😮', 
    '😢', '😭', '😡', '🤯', '👍', '👎', '❤️', '💯',
    '🔥', '✨', '🎉', '👏', '🤝', '💪', '🙌', '🤷',
    '😴', '🤗', '😇', '🤩', '😱', '🤪', '😋', '🧠'
];

// Initialize the app
function init() {
    setupEventListeners();
    setupEmojiPicker();
    setupThemeToggle();
    setupTypingIndicator();
    setupMessageInput();
    
    // Join chatroom
    socket.emit('joinRoom', { username, room });
    
    // Set initial focus
    messageInput.focus();
}

// Set up all event listeners
function setupEventListeners() {
    // Chat form submission
    chatForm.addEventListener('submit', handleMessageSubmit);
    
    // Socket events
    socket.on('roomUsers', handleRoomUsers);
    socket.on('message', handleMessage);
    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);
    
    // Emoji picker toggle
    emojiButton.addEventListener('click', toggleEmojiPicker);
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiPicker.contains(e.target) && !emojiButton.contains(e.target)) {
            emojiPicker.classList.remove('show');
        }
    });
}

// Handle message form submission
function handleMessageSubmit(e) {
    e.preventDefault();
    
    const msg = messageInput.value.trim();
    if (!msg) return;
    
    // Emit message to server
    socket.emit('chatMessage', msg);
    
    // Clear input and reset
    messageInput.value = '';
    messageInput.style.height = 'auto';
    sendButton.disabled = true;
    
    // Stop typing indicator
    if (isTyping) {
        socket.emit('stopTyping');
        isTyping = false;
    }
    
    messageInput.focus();
}

// Handle room users update
function handleRoomUsers({ room: roomData, users }) {
    outputRoomName(roomData);
    outputUsers(users);
    
    if (userCount) {
        userCount.textContent = users.length;
    }
}

// Handle incoming messages
function handleMessage(message) {
    outputMessage(message);
    playNotificationSound();
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Handle user typing
function handleUserTyping({ username: typingUser }) {
    if (typingUser !== currentUser) {
        showTypingIndicator(typingUser);
    }
}

// Handle user stopped typing
function handleUserStoppedTyping({ username: typingUser }) {
    if (typingUser !== currentUser) {
        hideTypingIndicator();
    }
}

// Output message to DOM with enhanced styling
function outputMessage(message) {
    const div = document.createElement('div');
    const isOwnMessage = message.username === currentUser;
    const isSystemMessage = message.username === 'ChatCord Bot';
    
    div.classList.add('message');
    
    if (isSystemMessage) {
        div.classList.add('system');
        div.innerHTML = `<p class="text">${message.text}</p>`;
    } else {
        div.classList.add(isOwnMessage ? 'own' : 'other');
        div.innerHTML = `
            <div class="meta">${message.username} <span>${message.time}</span></div>
            <div class="text">${formatMessageText(message.text)}</div>
            <div class="message-actions">
                <button class="message-action" onclick="copyMessage('${message.text.replace(/'/g, "\\'")}')">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="message-action" onclick="reactToMessage(this, '❤️')">
                    <i class="fas fa-heart"></i>
                </button>
            </div>
        `;
    }
    
    chatMessages.appendChild(div);
    
    // Add entrance animation
    setTimeout(() => div.classList.add('fade-in'), 10);
}

// Format message text (add emoji support, links, etc.)
function formatMessageText(text) {
    // Convert URLs to clickable links
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    let formattedText = text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    
    // Add line breaks for better formatting
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
}

// Output room name to DOM
function outputRoomName(room) {
    roomName.innerText = room;
}

// Output users to DOM with avatars
function outputUsers(users) {
    userList.innerHTML = users.map(user => {
        const avatar = user.username.charAt(0).toUpperCase();
        const isCurrentUser = user.username === currentUser;
        
        return `
            <div class="user-item ${isCurrentUser ? 'current-user' : ''}">
                <div class="user-avatar">${avatar}</div>
                <div class="user-info">
                    <div class="user-name">${user.username} ${isCurrentUser ? '(You)' : ''}</div>
                    <div class="user-status">
                        <div class="status-indicator"></div>
                        Online
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Setup emoji picker
function setupEmojiPicker() {
    emojiPicker.innerHTML = popularEmojis.map(emoji => 
        `<button type="button" class="emoji-item" onclick="insertEmoji('${emoji}')">${emoji}</button>`
    ).join('');
}

// Toggle emoji picker
function toggleEmojiPicker() {
    emojiPicker.classList.toggle('show');
}

// Insert emoji into message input
function insertEmoji(emoji) {
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(cursorPos);
    
    messageInput.value = textBefore + emoji + textAfter;
    messageInput.focus();
    messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    
    emojiPicker.classList.remove('show');
    updateSendButton();
}

// Setup theme toggle
function setupThemeToggle() {
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon(currentTheme);
    
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

// Update theme icon
function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
}

// Setup typing indicator
function setupTypingIndicator() {
    messageInput.addEventListener('input', () => {
        if (!isTyping && messageInput.value.trim()) {
            isTyping = true;
            socket.emit('typing');
        }
        
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            if (isTyping) {
                isTyping = false;
                socket.emit('stopTyping');
            }
        }, 1000);
        
        updateSendButton();
    });
}

// Setup message input enhancements
function setupMessageInput() {
    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
    
    // Handle Enter key
    messageInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
    
    // Initial send button state
    updateSendButton();
}

// Update send button state
function updateSendButton() {
    sendButton.disabled = !messageInput.value.trim();
}

// Show typing indicator
function showTypingIndicator(username) {
    hideTypingIndicator(); // Remove any existing indicator
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
        <span>${username} is typing</span>
        <div class="typing-dots">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Hide typing indicator
function hideTypingIndicator() {
    const existingIndicator = document.getElementById('typing-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
}

// Utility functions
function copyMessage(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Message copied to clipboard!');
    });
}

function reactToMessage(button, emoji) {
    button.innerHTML = emoji;
    button.style.background = 'var(--success-color)';
    setTimeout(() => {
        button.innerHTML = '<i class="fas fa-heart"></i>';
        button.style.background = '';
    }, 2000);
}

function showToast(message) {
    // Simple toast notification
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success-color);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function playNotificationSound() {
    // Create a subtle notification sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

// Mobile sidebar toggle
function toggleSidebar() {
    const sidebar = document.querySelector('.chat-sidebar');
    sidebar.classList.toggle('mobile-show');
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 