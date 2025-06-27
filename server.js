const path = require('path');
const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const botName = 'ChatCord Bot';
const formatMessage = require('./utils/messages');
const { userJoin, getCurrentUser, userLeave, getRoomUsers } = require('./utils/users');

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Store typing users
const typingUsers = new Map();

// Run when client connects
io.on('connection', socket => {
    console.log(`New WS Connection: ${socket.id}`);
    
    socket.on('joinRoom', ({ username, room }) => {
        const user = userJoin(socket.id, username, room);
        socket.join(user.room);

        // Welcome current user
        socket.emit('message', formatMessage(botName, `Welcome to ChatterBox, ${user.username}! 🎉`));

        // Broadcast when user connects
        socket.broadcast
            .to(user.room)
            .emit('message', formatMessage(botName, `${user.username} has joined the chat 👋`));

        // Send users and room info
        io.to(user.room).emit('roomUsers', {
            room: user.room,
            users: getRoomUsers(user.room)
        });
    });

    // Listen for chat message
    socket.on('chatMessage', (msg) => {
        const user = getCurrentUser(socket.id);
        
        if (user) {
            // Remove user from typing if they were typing
            if (typingUsers.has(socket.id)) {
                typingUsers.delete(socket.id);
                socket.broadcast.to(user.room).emit('userStoppedTyping', { username: user.username });
            }
            
            io.to(user.room).emit('message', formatMessage(user.username, msg));
        }
    });

    // Handle typing events
    socket.on('typing', () => {
        const user = getCurrentUser(socket.id);
        if (user && !typingUsers.has(socket.id)) {
            typingUsers.set(socket.id, user.username);
            socket.broadcast.to(user.room).emit('userTyping', { username: user.username });
        }
    });

    socket.on('stopTyping', () => {
        const user = getCurrentUser(socket.id);
        if (user && typingUsers.has(socket.id)) {
            typingUsers.delete(socket.id);
            socket.broadcast.to(user.room).emit('userStoppedTyping', { username: user.username });
        }
    });

    // Handle user disconnect
    socket.on('disconnect', () => {
        const user = userLeave(socket.id);
        
        if (user) {
            // Remove from typing users
            if (typingUsers.has(socket.id)) {
                typingUsers.delete(socket.id);
                socket.broadcast.to(user.room).emit('userStoppedTyping', { username: user.username });
            }
            
            io.to(user.room).emit('message', 
                formatMessage(botName, `${user.username} has left the chat 👋`)
            );

            // Send users and room info
            io.to(user.room).emit('roomUsers', {
                room: user.room,
                users: getRoomUsers(user.room)
            });
        }
        
        console.log(`Connection closed: ${socket.id}`);
    });

    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// 404 handler
app.use('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
    console.log(`🚀 ChatterBox server running on port ${PORT}`);
    console.log(`📱 Local: http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('Process terminated');
    });
});
