require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const authRoutes = require('./src/auth');
const websocketHandler = require('./src/websocket');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static('public'));

// Rotte per autenticazione
app.use('/auth', authRoutes);

// Gestione WebSocket
wss.on('connection', (ws, req) => websocketHandler(ws, req));

server.listen(process.env.PORT, () => {
    console.log(`Server in ascolto sulla porta ${process.env.PORT}`);
});
