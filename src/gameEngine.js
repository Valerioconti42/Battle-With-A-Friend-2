const GRAVITY = 0.5;
const GROUND_Y = 500; // y del pavimento
const PLAYER_RADIUS = 20;
const SWORD_LENGTH = 40;
const BOUNCE_DAMPING = 0.7; // per evitare rimbalzi infiniti

class Game {
    constructor(id, player1, player2) {
        this.id = id;
        this.player1 = player1;
        this.player2 = player2;
        // Stato iniziale: sfere a sinistra e destra
        this.players = {
            [player1]: {
                x: 200, y: 200, vx: 0, vy: 0,
                angle: 0, // gradi, 0 = verso destra
            },
            [player2]: {
                x: 600, y: 200, vx: 0, vy: 0,
                angle: 180, // punta verso sinistra
            }
        };
        this.lastUpdate = Date.now();
        this.inputs = { [player1]: { left: false, right: false }, [player2]: { left: false, right: false } };
        this.finished = false;
    }

    // Aggiorna la fisica (delta time in ms)
    update(dt) {
        if (this.finished) return;

        const seconds = dt / 1000;

        // Applica input (cambia angolo)
        for (let id of [this.player1, this.player2]) {
            const p = this.players[id];
            if (this.inputs[id].left) {
                p.angle = (p.angle - 45 + 360) % 360;
            }
            if (this.inputs[id].right) {
                p.angle = (p.angle + 45) % 360;
            }
            // reset input per evitare rotazioni multiple per frame
            this.inputs[id].left = false;
            this.inputs[id].right = false;
        }

        // Applica gravità
        for (let id of [this.player1, this.player2]) {
            const p = this.players[id];
            p.vy += GRAVITY * seconds * 60; // scala approssimativa per 60fps
            p.x += p.vx * seconds * 60;
            p.y += p.vy * seconds * 60;
        }

        // Collisioni con il suolo
        for (let id of [this.player1, this.player2]) {
            const p = this.players[id];
            if (p.y + PLAYER_RADIUS > GROUND_Y) {
                p.y = GROUND_Y - PLAYER_RADIUS;
                p.vy = -p.vy * BOUNCE_DAMPING;
                if (Math.abs(p.vy) < 1) p.vy = 0;
            }
        }

        // Collisione tra sfere
        const p1 = this.players[this.player1];
        const p2 = this.players[this.player2];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < 2 * PLAYER_RADIUS) {
            // Rimbalzo elastico approssimato
            const overlap = 2 * PLAYER_RADIUS - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            // Separazione
            p1.x -= nx * overlap/2;
            p1.y -= ny * overlap/2;
            p2.x += nx * overlap/2;
            p2.y += ny * overlap/2;

            // Scambio di velocità lungo la normale
            const v1n = p1.vx * nx + p1.vy * ny;
            const v2n = p2.vx * nx + p2.vy * ny;
            if (v1n - v2n > 0) { // si stanno avvicinando
                const v1t = p1.vx - v1n * nx, p1.vy - v1n * ny; // tangenziale invariata
                const v2t = p2.vx - v2n * nx, p2.vy - v2n * ny;
                const newV1n = v2n * BOUNCE_DAMPING;
                const newV2n = v1n * BOUNCE_DAMPING;
                p1.vx = v1t + newV1n * nx;
                p1.vy = v1t? wait...
            }
        }

        // Controllo spada (collisione con l'avversario)
        for (let attacker of [this.player1, this.player2]) {
            const a = this.players[attacker];
            const defender = attacker === this.player1 ? this.player2 : this.player1;
            const d = this.players[defender];

            // Calcola punta della spada
            const swordAngleRad = a.angle * Math.PI / 180;
            const swordTipX = a.x + Math.cos(swordAngleRad) * SWORD_LENGTH;
            const swordTipY = a.y + Math.sin(swordAngleRad) * SWORD_LENGTH;

            // Distanza tra punta e centro avversario
            const distToDefender = Math.hypot(swordTipX - d.x, swordTipY - d.y);
            if (distToDefender < PLAYER_RADIUS) {
                // Colpito!
                this.finished = true;
                return attacker; // winner
            }
        }
        return null;
    }
}

function createGame(gameId, player1Id, player2Id, clients) {
    return new Game(gameId, player1Id, player2Id);
}

function startGameLoop(game, clients, endCallback) {
    const interval = setInterval(() => {
        if (game.finished) {
            clearInterval(interval);
            return;
        }
        const now = Date.now();
        const dt = now - (game.lastUpdate || now);
        game.lastUpdate = now;

        const winner = game.update(dt);
        if (winner) {
            // Invia stato finale e termina
            game.finished = true;
            sendGameState(game, clients);
            endCallback(game, winner);
        } else {
            sendGameState(game, clients);
        }
    }, 1000 / 60); // 60 fps
}

function sendGameState(game, clients) {
    const state = {
        type: 'game_state',
        players: {
            [game.player1]: game.players[game.player1],
            [game.player2]: game.players[game.player2],
        },
        finished: game.finished,
        winner: game.finished ? (game.players[game.player1]?.winner ? game.player1 : game.player2) : null
    };
    clients.get(game.player1).ws.send(JSON.stringify(state));
    clients.get(game.player2).ws.send(JSON.stringify(state));
}

function handleGameInput(userId, input) {
    // input: { left: boolean, right: boolean }
    // Trova il gioco in cui l'utente è presente
    for (let game of games.values()) {
        if (game.player1 === userId || game.player2 === userId) {
            // Imposta l'input per il prossimo frame
            if (input.left) game.inputs[userId].left = true;
            if (input.right) game.inputs[userId].right = true;
            break;
        }
    }
}

module.exports = { createGame, startGameLoop, handleGameInput };
