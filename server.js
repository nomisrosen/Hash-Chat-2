const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    maxHttpBufferSize: 1e8 // 100 MB
});

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage
const rooms = {}; // { roomId: [messages] }
const users = {}; // { socketId: { username, roomId } }

// Helper to generate random username
const adjectives = ['Happy', 'Sleepy', 'Grumpy', 'Sneezy', 'Dopey', 'Bashful', 'Doc', 'Swift', 'Silent', 'Brave'];
const animals = ['Badger', 'Fox', 'Owl', 'Bear', 'Raccoon', 'Eagle', 'Wolf', 'Tiger', 'Lion', 'Hawk'];

function generateUsername() {
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const animal = animals[Math.floor(Math.random() * animals.length)];
    return `Anonymous ${adj} ${animal}`;
}

// New helper functions for user management and message formatting
function userJoin(id, username, room) {
    const user = { id, username, room };
    users[id] = user;
    return user;
}

function formatMessage(username, text) {
    return {
        user: username,
        type: 'text',
        content: text,
        timestamp: new Date().toISOString()
    };
}

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('joinRoom', (roomId, customUsername) => {
        const user = userJoin(socket.id, customUsername || generateUsername(), roomId);
        socket.join(user.room);

        // Send welcome message
        socket.emit('message', formatMessage('System', 'Welcome to Hash Chat!'));

        // Initialize room if not exists
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }

        // Send history
        socket.emit('history', rooms[roomId]);

        // Tell client their username
        socket.emit('joined', { username: user.username });

        // Notify room
        io.to(roomId).emit('message', {
            user: 'System',
            type: 'text',
            content: `${user.username} has joined the chat`,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('chatMessage', (msgData) => {
        const user = users[socket.id];
        if (user) {
            // msgData can be string (legacy) or object { type, content }
            // Normalize to object
            let messagePayload = {
                user: user.username,
                timestamp: new Date().toISOString()
            };

            if (typeof msgData === 'string') {
                messagePayload.type = 'text';
                messagePayload.content = msgData;
            } else {
                // Spread all properties from msgData to preserve encrypted message fields
                messagePayload = {
                    ...messagePayload,
                    ...msgData
                };
            }

            // Store message
            if (rooms[user.room]) {
                rooms[user.room].push(messagePayload);
                // Keep only last 100 messages
                if (rooms[user.room].length > 100) {
                    rooms[user.room].shift();
                }
            }

            io.to(user.room).emit('message', messagePayload);
        }
    });

    socket.on('typing', () => {
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('userTyping', { username: user.username });
        }
    });

    socket.on('stopTyping', () => {
        const user = users[socket.id];
        if (user) {
            socket.to(user.room).emit('userStoppedTyping', { username: user.username });
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.room).emit('message', {
                user: 'System',
                type: 'text',
                content: `${user.username} has left the chat`,
                timestamp: new Date().toISOString()
            });
            delete users[socket.id];
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
