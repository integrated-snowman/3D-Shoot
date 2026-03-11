import { initWorld, scene, camera, renderer } from './world.js';
import { initControls, updatePhysics, createLocalPlayer, createOrUpdatePlayer, respawnPlayer } from './player.js';
import { initNetworking, isHost, networkTick, startNetworkingGame } from './network.js';
import { initUI, showLobby, updateHUD, showToast } from './ui.js';

// Global Config
const CONFIG = {
    tickRate: 30
};

// Main Initialization
function init() {
    initWorld();
    initControls();
    initUI();
    
    // Start Render Loop
    animate();
    
    console.log("CodeStrike 3D Initialized");
}

// Game Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.1);

    // Update Physics
    updatePhysics(delta);

    // Update Networking
    networkTick();

    // Render
    renderer.render(scene, camera);
}

// Export functions used by UI/Network events
window.gameActions = {
    createMatch: () => {
        showToast('Creating Lobby...');
        initNetworking(true);
    },
    joinMatch: (code) => {
        if (code.length !== 6) {
            showToast('Invalid Code');
            return;
        }
        showToast('Connecting...');
        initNetworking(false, code);
    },
    startGame: () => {
        if (isHost) {
            startNetworkingGame();
        }
    },
    enterGame: () => {
        // Triggered after network confirms start
        document.getElementById('lobby-screen').classList.add('hidden');
        document.getElementById('hud-screen').classList.remove('hidden');
        
        // Reset position
        camera.position.set(0, 2, 0);
        createLocalPlayer(); // Ensure local player mesh exists at camera pos
        
        // Lock pointer
        document.body.requestPointerLock();
    }
};

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

init();
