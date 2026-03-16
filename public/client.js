let socket;
let token = localStorage.getItem('token');
let username = localStorage.getItem('username');

// Autenticazione: se non c'è token, reindirizza a login
if (!token) window.location.href = '/';

// Connessione WebSocket
function connectWebSocket() {
    socket = new WebSocket(`ws://${window.location.host}?token=${token}`);

    socket.onopen = () => {
        console.log('Connesso');
    };

    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
            case 'online_users':
                updateOnlineUsers(data.users);
                break;
            case 'invite_received':
                showInviteModal(data.from, data.inviterId);
                break;
            case 'game_state':
                renderGame(data);
                break;
            case 'invite_declined':
                alert(`${data.by} ha rifiutato l'invito`);
                break;
        }
    };
}

// Invio invito
function sendInvite(targetUsername) {
    socket.send(JSON.stringify({ type: 'invite', targetUsername }));
}

// Accetta invito
function acceptInvite(inviterId) {
    socket.send(JSON.stringify({ type: 'accept_invite', inviterId }));
    closeModal();
}

// Rifiuta invito
function declineInvite(inviterId) {
    socket.send(JSON.stringify({ type: 'decline_invite', inviterId }));
    closeModal();
}

// Gestione input (freccia sinistra/destra)
document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
        socket.send(JSON.stringify({ type: 'game_input', input: { left: true, right: false } }));
    } else if (e.key === 'ArrowRight') {
        socket.send(JSON.stringify({ type: 'game_input', input: { left: false, right: true } }));
    }
});

// Rendering del gioco (canvas)
function renderGame(state) {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Disegna le sfere e le spade
    for (let id in state.players) {
        const p = state.players[id];
        ctx.beginPath();
        ctx.arc(p.x, p.y, 20, 0, 2 * Math.PI);
        ctx.fillStyle = id === username ? 'blue' : 'red';
        ctx.fill();

        // Spada
        const angleRad = p.angle * Math.PI / 180;
        const tipX = p.x + Math.cos(angleRad) * 40;
        const tipY = p.y + Math.sin(angleRad) * 40;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    if (state.finished) {
        ctx.font = '30px Arial';
        ctx.fillStyle = 'green';
        ctx.fillText(`Vince: ${state.winner}`, 200, 100);
    }
}

connectWebSocket();
