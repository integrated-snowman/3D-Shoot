import { players } from './player.js';

// Cache DOM elements
const screens = {
    menu: document.getElementById('menu-screen'),
    lobby: document.getElementById('lobby-screen'),
    hud: document.getElementById('hud-screen'),
    respawn: document.getElementById('respawn-screen')
};

const els = {
    codeDisplay: document.getElementById('lobby-code-display'),
    lobbyTitle: document.getElementById('lobby-title'),
    playerList: document.getElementById('player-list'),
    lobbyMsg: document.getElementById('lobby-msg'),
    btnStart: document.getElementById('btn-start-game'),
    btnLeave: document.getElementById('btn-leave-lobby'),
    hpVal: document.getElementById('hp-val'),
    hpFill: document.getElementById('health-fill'),
    hitMarker: document.getElementById('hit-marker'),
    killFeed: document.getElementById('kill-feed'),
    toastContainer: document.getElementById('toast-container')
};

export function initUI() {
    // Menu Buttons
    document.getElementById('btn-create').addEventListener('click', () => {
        window.gameActions.createMatch();
    });

    document.getElementById('btn-join').addEventListener('click', () => {
        const code = document.getElementById('input-code').value.trim();
        window.gameActions.joinMatch(code);
    });

    // Lobby Buttons
    els.btnStart.addEventListener('click', () => {
        window.gameActions.startGame();
    });

    els.btnLeave.addEventListener('click', () => {
        location.reload();
    });
}

export function showLobby(code, isHost) {
    screens.menu.classList.add('hidden');
    screens.lobby.classList.remove('hidden');
    els.codeDisplay.innerText = code;

    if (isHost) {
        els.lobbyTitle.innerText = "Hosting Lobby";
        els.btnStart.style.display = 'block';
        updateLobbyUI();
    } else {
        els.lobbyTitle.innerText = "Joined Lobby";
        els.btnStart.style.display = 'none';
    }
}

export function updateLobbyUI() {
    els.playerList.innerHTML = '';
    // Access players from player.js (imported)
    Object.keys(players).forEach(id => {
        const li = document.createElement('li');
        li.innerText = id === window.myPeerId ? "You (Host)" : `Player ${id.substring(0,4)}`;
        els.playerList.appendChild(li);
    });
    
    const count = Object.keys(players).length;
    els.lobbyMsg.innerText = count >= 2 ? "Ready to Start!" : "Waiting for players...";
}

export function updateHUD(hp) {
    els.hpVal.innerText = Math.max(0, hp);
    const pct = Math.max(0, (hp / 100) * 100);
    els.hpFill.style.width = pct + '%';
    if (pct < 30) els.hpFill.style.background = 'var(--danger)';
    else els.hpFill.style.background = 'var(--primary)';
}

export function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerText = msg;
    els.toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 3500);
}

export function showHitMarker() {
    els.hitMarker.style.opacity = 1;
    setTimeout(() => els.hitMarker.style.opacity = 0, 100);
}

export function addKillFeed(killer, victim) {
    const div = document.createElement('div');
    div.className = 'kill-msg';
    div.innerHTML = `<span class="kill-name">${killer.substring(0,5)}</span> eliminated <span class="kill-name">${victim.substring(0,5)}</span>`;
    els.killFeed.appendChild(div);
    setTimeout(() => div.remove(), 4000);
}
