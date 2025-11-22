const socket = io({ autoConnect: false });

const landingPage = document.getElementById('landing-page');
const chatPage = document.getElementById('chat-page');
const secretInput = document.getElementById('secret-phrase');
const joinBtn = document.getElementById('join-btn');
const roomIdDisplay = document.getElementById('room-id-display');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const msgInput = document.getElementById('msg-input');
const leaveBtn = document.getElementById('leave-btn');

let currentUsername = '';

// Hashing Function
async function hashPhrase(phrase) {
    const encoder = new TextEncoder();
    const data = encoder.encode(phrase);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

// Join Room
joinBtn.addEventListener('click', async () => {
    const phrase = secretInput.value.trim();
    if (!phrase) return;

    const roomId = await hashPhrase(phrase);

    // Connect socket
    socket.auth = { roomId }; // Optional: send auth data if needed, but here we just join
    socket.connect();

    socket.emit('joinRoom', roomId);

    // Update UI
    landingPage.classList.add('hidden');
    chatPage.classList.remove('hidden');
    roomIdDisplay.textContent = roomId.substring(0, 12) + '...';
});

// Leave Room
leaveBtn.addEventListener('click', () => {
    socket.disconnect();
    landingPage.classList.remove('hidden');
    chatPage.classList.add('hidden');
    secretInput.value = '';
    chatMessages.innerHTML = '';
});

const fileInput = document.getElementById('file-input');

// Image Upload
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Limit size to 2MB
    if (file.size > 2 * 1024 * 1024) {
        alert('Image too large (max 2MB)');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const base64 = reader.result;
        socket.emit('chatMessage', { type: 'image', content: base64 });
    };
    reader.readAsDataURL(file);
    fileInput.value = ''; // Reset
});

// Send Message
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = msgInput.value.trim();
    if (msg) {
        socket.emit('chatMessage', { type: 'text', content: msg });
        msgInput.value = '';
        msgInput.focus();
    }
});

// Socket Events
socket.on('history', (messages) => {
    chatMessages.innerHTML = '';
    messages.forEach(addMessageToUI);
    scrollToBottom();
});

socket.on('joined', (data) => {
    currentUsername = data.username;
});

socket.on('message', (msg) => {
    addMessageToUI(msg);
    scrollToBottom();
});

function addMessageToUI(msg) {
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
            img.onclick = () => window.open(msg.content, '_blank');
            contentDiv.appendChild(img);
        } else {
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
