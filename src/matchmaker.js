const gameEngine = require('./gameEngine');
const db = require('./db');

const pendingInvites = new Map(); // inviterId -> targetId
const games = new Map(); // gameId -> istanza Game

function handleInvite(inviterId, targetUsername, clients) {
    let targetId = null;
    for (let [id, client] of clients) {
        if (client.username === targetUsername) {
            targetId = id;
            break;
        }
    }
    if (!targetId) return; // utente non online

    pendingInvites.set(inviterId, targetId);
    const targetWs = clients.get(targetId).ws;
    targetWs.send(JSON.stringify({ type: 'invite_received', from: clients.get(inviterId).username, inviterId }));
}

function acceptInvite(acceptorId, inviterId, clients) {
    if (pendingInvites.get(inviterId) !== acceptorId) return;

    pendingInvites.delete(inviterId);
    // Crea una nuova partita
    const gameId = `game_${Date.now()}_${inviterId}_${acceptorId}`;
    const game = gameEngine.createGame(gameId, inviterId, acceptorId, clients);
    games.set(gameId, game);

    // Avvia il game loop (simulazione fisica)
    gameEngine.startGameLoop(game, clients, gameEndCallback);
}

function declineInvite(acceptorId, inviterId, clients) {
    if (pendingInvites.get(inviterId) === acceptorId) {
        pendingInvites.delete(inviterId);
        clients.get(inviterId).ws.send(JSON.stringify({ type: 'invite_declined', by: clients.get(acceptorId).username }));
    }
}

function userDisconnected(userId) {
    // Se l'utente era in una partita, termina la partita (vittoria all'avversario)
    for (let [gameId, game] of games) {
        if (game.player1 === userId || game.player2 === userId) {
            gameEngine.endGame(game, userId === game.player1 ? game.player2 : game.player1, 'disconnessione');
            games.delete(gameId);
            break;
        }
    }
    // Rimuovi inviti pendenti
    pendingInvites.forEach((target, inviter) => {
        if (inviter === userId || target === userId) pendingInvites.delete(inviter);
    });
}

async function gameEndCallback(game, winnerId) {
    // Aggiorna trofei nel database
    const loserId = (winnerId === game.player1) ? game.player2 : game.player1;
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('UPDATE users SET trophies = trophies + 10 WHERE id = ?', [winnerId]);
        await conn.query('UPDATE users SET trophies = trophies - 5 WHERE id = ?', [loserId]);
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        console.error('Errore aggiornamento trofei', err);
    } finally {
        conn.release();
    }
    games.delete(game.id);
}

module.exports = { handleInvite, acceptInvite, declineInvite, userDisconnected };
