const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

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

io.on('connection', (socket) => {
    console.log('New client connected');

    socket.on('joinRoom', (roomId) => {
        const username = generateUsername();
        socket.join(roomId);

        users[socket.id] = { username, roomId };

        // Initialize room if not exists
        if (!rooms[roomId]) {
            rooms[roomId] = [];
        }

        // Send history
        socket.emit('history', rooms[roomId]);

        // Tell client their username
        socket.emit('joined', { username });

        // Notify room
        io.to(roomId).emit('message', {
            user: 'System',
            text: `${username} has joined the chat`,
            timestamp: new Date().toISOString()
        });
    });

    socket.on('chatMessage', (msg) => {
        const user = users[socket.id];
        if (user) {
            const messageData = {
                user: user.username,
                text: msg,
                timestamp: new Date().toISOString()
            };

            // Store message
            if (rooms[user.roomId]) {
                rooms[user.roomId].push(messageData);
                // Keep only last 100 messages
                if (rooms[user.roomId].length > 100) {
                    rooms[user.roomId].shift();
                }
            }

            io.to(user.roomId).emit('message', messageData);
        }
    });

    socket.on('disconnect', () => {
        const user = users[socket.id];
        if (user) {
            io.to(user.roomId).emit('message', {
                user: 'System',
                text: `${user.username} has left the chat`,
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
