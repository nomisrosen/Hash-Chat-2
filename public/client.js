const socket = io({ autoConnect: false });

const landingPage = document.getElementById('landing-page');
const chatPage = document.getElementById('chat-page');
const secretInput = document.getElementById('secret-phrase');
const joinBtn = document.getElementById('join-btn');
const roomIdDisplay = document.getElementById('room-id-display'); // Keeping this for legacy, though we use room-name-display now
const roomNameDisplay = document.getElementById('room-name-display');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');
const leaveBtn = document.getElementById('leave-btn');
const fileInput = document.getElementById('file-input');
const imagePreviewArea = document.getElementById('image-preview-area');
const typingIndicator = document.getElementById('typing-indicator');
const sidebar = document.getElementById('main-sidebar');
const sidebarToggle = document.getElementById('sidebar-toggle');
const usernameInput = document.getElementById('username-input'); // Added username input element

// Modal Elements
const imageModal = document.getElementById('image-modal');
const modalImage = document.getElementById('modal-image');
const closeModal = document.querySelector('.close-modal');

let currentUsername = '';
let currentImage = null;
let activeRooms = []; // Array of { id, name }
let currentRoomId = null;

// Hashing Function
async function hashPhrase(phrase) {
    const encoder = new TextEncoder();
    const data = encoder.encode(phrase);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Join Room Logic
async function joinRoom(phrase, customUsername = null) { // Updated to accept customUsername
    if (!phrase) return;

    const roomId = await hashPhrase(phrase);
    currentRoomId = roomId;

    // Derive encryption key from the phrase
    try {
        await cryptoManager.deriveKey(phrase);
        console.log('🔒 Encryption key derived successfully');
    } catch (error) {
        console.error('Failed to derive encryption key:', error);
        alert('Failed to initialize encryption. Please try again.');
        return;
    }

    // Add to active rooms if not exists
    if (!activeRooms.find(r => r.id === roomId)) {
        activeRooms.push({ id: roomId, name: phrase });
        renderSidebarTabs();
    }

    // Connect socket
    if (socket.connected) {
        socket.disconnect();
    }

    socket.auth = { roomId };
    socket.connect();
    socket.emit('joinRoom', roomId, customUsername); // Pass customUsername to socket.emit

    // Update UI
    landingPage.classList.add('hidden');
    chatPage.classList.remove('hidden');
    if (roomIdDisplay) roomIdDisplay.textContent = roomId.substring(0, 12) + '...';
    if (roomNameDisplay) roomNameDisplay.textContent = phrase;

    chatMessages.innerHTML = '';

    // Add encryption notice
    const notice = document.createElement('div');
    notice.classList.add('encryption-notice');
    notice.textContent = 'Messages are end-to-end encrypted';
    chatMessages.appendChild(notice);

    clearImagePreview();
    updateActiveTab();
}

// Sidebar Toggle
sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('expanded');
});

// Join Room Events (Landing Page)
joinBtn.addEventListener('click', () => joinRoom(secretInput.value.trim(), usernameInput.value.trim())); // Pass username

secretInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        joinRoom(secretInput.value.trim(), usernameInput.value.trim()); // Pass username
    }
});

// Leave Room
leaveBtn.addEventListener('click', () => {
    socket.disconnect();
    landingPage.classList.remove('hidden');
    chatPage.classList.add('hidden');
    secretInput.value = '';
    chatMessages.innerHTML = '';
    clearImagePreview();
    currentRoomId = null;

    // Clear encryption key for security
    cryptoManager.clearKey();
    console.log('🔓 Encryption key cleared');

    // Remove from active rooms? Or keep it? 
    // User said "tab across chat's they've opened", implying keeping them.
    // But "Leave" usually implies closing. Let's keep it simple: Leave = Close tab.
    // Need to handle this better. For now, Leave just goes back to home.
    // If we want tabs to persist, we shouldn't remove them on "Leave", but maybe have a "Close" on the tab.
    // For this iteration, "Leave" will just go back to home, but tabs remain.
    updateActiveTab();
});

// Image Upload Handling
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert('Image too large (max 2MB)');
        fileInput.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        currentImage = reader.result;
        showImagePreview(currentImage);
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
});

function showImagePreview(base64) {
    imagePreviewArea.innerHTML = '';
    const previewItem = document.createElement('div');
    previewItem.classList.add('preview-item');

    const img = document.createElement('img');
    img.src = base64;

    const removeBtn = document.createElement('div');
    removeBtn.classList.add('preview-remove');
    removeBtn.textContent = '✕';
    removeBtn.onclick = () => clearImagePreview();

    previewItem.appendChild(img);
    previewItem.appendChild(removeBtn);
    imagePreviewArea.appendChild(previewItem);
}

function clearImagePreview() {
    currentImage = null;
    imagePreviewArea.innerHTML = '';
}

// Send Message
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = msgInput.value.trim();

    if (msg) {
        try {
            // Encrypt the message before sending
            const { ciphertext, iv } = await cryptoManager.encrypt(msg);
            socket.emit('chatMessage', {
                type: 'encrypted',
                ciphertext: ciphertext,
                iv: iv
            });
            msgInput.value = '';
        } catch (error) {
            console.error('Encryption failed:', error);
            alert('Failed to encrypt message. Please try rejoining the room.');
            return;
        }
    }

    if (currentImage) {
        // Images are sent unencrypted for now
        socket.emit('chatMessage', { type: 'image', content: currentImage });
        clearImagePreview();
    }

    msgInput.focus();
});

// Typing Indicator Logic
let typingTimeout;

msgInput.addEventListener('input', () => {
    if (currentRoomId) {
        socket.emit('typing');
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            socket.emit('stopTyping');
        }, 1000);
    }
});

socket.on('userTyping', (data) => {
    typingIndicator.textContent = `${data.username} is typing...`;
    typingIndicator.classList.add('active');
});

socket.on('userStoppedTyping', () => {
    typingIndicator.classList.remove('active');
});

// Socket Events
socket.on('history', async (messages) => {
    chatMessages.innerHTML = '';

    // Re-add encryption notice
    const notice = document.createElement('div');
    notice.classList.add('encryption-notice');
    notice.textContent = 'Messages are end-to-end encrypted';
    chatMessages.appendChild(notice);

    // Process messages sequentially to maintain order
    for (const msg of messages) {
        await addMessageToUI(msg);
    }
    scrollToBottom();
});

socket.on('joined', (data) => {
    currentUsername = data.username;
});

socket.on('message', (msg) => {
    addMessageToUI(msg);
    scrollToBottom();
});

async function addMessageToUI(msg) {
    const div = document.createElement('div');
    div.classList.add('message');

    if (msg.user === 'System') {
        div.classList.add('system');
        div.textContent = msg.content;
    } else {
        if (msg.user === currentUsername) {
            div.classList.add('own');
        } else {
            div.classList.add('other');
        }

        const meta = document.createElement('div');
        meta.classList.add('message-meta');
        meta.textContent = msg.user;

        const contentDiv = document.createElement('div');
        contentDiv.classList.add('message-content');

        if (msg.type === 'image') {
            const img = document.createElement('img');
            img.src = msg.content;
            img.onclick = () => {
                modalImage.src = msg.content;
                imageModal.classList.add('active');
            };
            img.onload = () => scrollToBottom(); // Ensure scroll after load
            contentDiv.appendChild(img);
        } else if (msg.type === 'encrypted') {
            // Decrypt the message
            try {
                const plaintext = await cryptoManager.decrypt(msg.ciphertext, msg.iv);
                contentDiv.textContent = plaintext;
            } catch (error) {
                console.error('Decryption failed:', error);
                contentDiv.textContent = '⚠️ Could not decrypt message';
                contentDiv.classList.add('decryption-error');
            }
        } else {
            // Fallback for unencrypted messages (legacy)
            contentDiv.textContent = msg.content;
        }

        div.appendChild(meta);
        div.appendChild(contentDiv);
    }

    chatMessages.appendChild(div);
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Sidebar New Chat Logic
const newChatIcon = document.getElementById('new-chat-icon');
const newChatPopout = document.getElementById('new-chat-popout');
const newChatInput = document.getElementById('new-chat-input');
const newChatGoBtn = document.getElementById('new-chat-go-btn');

newChatIcon.addEventListener('click', (e) => {
    if (e.target === newChatInput || e.target === newChatGoBtn || (newChatGoBtn && newChatGoBtn.contains(e.target))) return;

    newChatPopout.classList.toggle('active');
    if (newChatPopout.classList.contains('active')) {
        newChatInput.focus();
    }
});

document.addEventListener('click', (e) => {
    if (!newChatIcon.contains(e.target) && !newChatPopout.contains(e.target)) {
        newChatPopout.classList.remove('active');
    }
});

async function handleNewChat() {
    const phrase = newChatInput.value.trim();
    const customUsername = usernameInput.value.trim(); // Get username from input
    if (!phrase) return; // Only proceed if phrase is not empty

    await joinRoom(phrase, customUsername); // Pass customUsername

    newChatInput.value = '';
    newChatPopout.classList.remove('active');
}

newChatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleNewChat();
    }
});

newChatGoBtn.addEventListener('click', handleNewChat);

// Modal Logic
closeModal.onclick = () => {
    imageModal.classList.remove('active');
};

window.onclick = (event) => {
    if (event.target === imageModal) {
        imageModal.classList.remove('active');
    }
};

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageModal.classList.contains('active')) {
        imageModal.classList.remove('active');
    }
});

// Sidebar Tabs Logic
function renderSidebarTabs() {
    // Remove existing tabs first (keep icons)
    const existingTabs = document.querySelectorAll('.tab-item');
    existingTabs.forEach(t => t.remove());

    const sidebar = document.querySelector('.sidebar');

    // Create container if not exists
    let tabsContainer = document.querySelector('.sidebar-tabs');
    if (!tabsContainer) {
        tabsContainer = document.createElement('div');
        tabsContainer.classList.add('sidebar-tabs');
        // Insert before newChatIcon or at a specific place
        const newChatIconContainer = document.getElementById('new-chat-icon-container'); // Assuming a container for the icon
        if (newChatIconContainer) {
            sidebar.insertBefore(tabsContainer, newChatIconContainer);
        } else {
            sidebar.appendChild(tabsContainer);
        }
    } else {
        tabsContainer.innerHTML = ''; // Clear
    }

    activeRooms.forEach(room => {
        const tab = document.createElement('div');
        tab.classList.add('tab-item');

        const initials = document.createElement('span');
        initials.classList.add('tab-initials');
        initials.textContent = room.name.substring(0, 2);
        tab.appendChild(initials);

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('tab-name');
        nameSpan.textContent = room.name;
        tab.appendChild(nameSpan);

        tab.title = room.name;
        tab.onclick = () => joinRoom(room.name);

        if (room.id === currentRoomId) {
            tab.classList.add('active');
        }

        tabsContainer.appendChild(tab);
    });
}

function updateActiveTab() {
    const tabs = document.querySelectorAll('.tab-item');
    tabs.forEach(tab => {
        if (tab.title === (activeRooms.find(r => r.id === currentRoomId)?.name || '')) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
}
