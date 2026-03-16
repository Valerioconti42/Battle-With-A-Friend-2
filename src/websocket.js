const jwt = require('jsonwebtoken');
const db = require('./db');
const matchmaker = require('./matchmaker');

const clients = new Map(); // userId -> { ws, username }

function websocketHandler(ws, req) {
    // Autenticazione: il token viene passato come query parameter (es. ?token=...)
    const params = new URLSearchParams(req.url.split('?')[1]);
    const token = params.get('token');
    if (!token) {
        ws.close(1008, 'Token mancante');
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        ws.userId = decoded.id;
        ws.username = decoded.username;
        clients.set(decoded.id, { ws, username: decoded.username });

        // Notifica a tutti gli utenti la nuova lista online
        broadcastOnlineUsers();

        ws.on('message', (data) => handleMessage(ws, data));
        ws.on('close', () => {
            clients.delete(ws.userId);
            broadcastOnlineUsers();
            matchmaker.userDisconnected(ws.userId);
        });
    } catch (err) {
        ws.close(1008, 'Token non valido');
    }
}

function handleMessage(ws, data) {
    try {
        const msg = JSON.parse(data);
        switch (msg.type) {
            case 'invite':
                matchmaker.handleInvite(ws.userId, msg.targetUsername, clients);
                break;
            case 'accept_invite':
                matchmaker.acceptInvite(ws.userId, msg.inviterId, clients);
                break;
            case 'decline_invite':
                matchmaker.declineInvite(ws.userId, msg.inviterId, clients);
                break;
            case 'game_input':
                matchmaker.handleGameInput(ws.userId, msg.input); // { left, right }
                break;
            default:
                console.log('Messaggio sconosciuto', msg);
        }
    } catch (e) {
        console.error('Errore nel parsing del messaggio', e);
    }
}

function broadcastOnlineUsers() {
    const users = Array.from(clients.values()).map(c => c.username);
    const payload = JSON.stringify({ type: 'online_users', users });
    clients.forEach(client => client.ws.send(payload));
}

module.exports = websocketHandler;
