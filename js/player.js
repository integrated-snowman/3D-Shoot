import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { scene, camera, worldObjects, createBulletTrail } from './world.js';
import { sendUpdate } from './network.js';
import { updateHUD, showHitMarker, addKillFeed } from './ui.js';

// State
export const players = {}; // Map: id -> { mesh, targetPos, targetRot, hp }
let localPlayer = { id: null, hp: 100, color: 0x00f3ff };
let myPeerId = null;

const CONFIG = {
    speed: 15,
    jump: 15,
    gravity: 40,
    colors: [0x00f3ff, 0xbc13fe, 0x00ff66, 0xffaa00]
};

// Physics & Controls
const controls = new PointerLockControls(camera, document.body);
const moveState = { forward: false, backward: false, left: false, right: false, jump: false };
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let canJump = false;

// Audio
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'shoot') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'hit') {
        osc.type = 'square'; osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'jump') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.start(); osc.stop(audioCtx.currentTime + 0.2);
    }
}

// Initialization
export function initControls() {
    const onKeyDown = (event) => {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': moveState.forward = true; break;
            case 'ArrowLeft': case 'KeyA': moveState.left = true; break;
            case 'ArrowDown': case 'KeyS': moveState.backward = true; break;
            case 'ArrowRight': case 'KeyD': moveState.right = true; break;
            case 'Space': if (canJump) { velocity.y = CONFIG.jump; canJump = false; playSound('jump'); } break;
        }
    };
    const onKeyUp = (event) => {
        switch (event.code) {
            case 'ArrowUp': case 'KeyW': moveState.forward = false; break;
            case 'ArrowLeft': case 'KeyA': moveState.left = false; break;
            case 'ArrowDown': case 'KeyS': moveState.backward = false; break;
            case 'ArrowRight': case 'KeyD': moveState.right = false; break;
        }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    document.addEventListener('mousedown', () => {
        if (controls.isLocked) shoot();
    });
}

export function setLocalPeerId(id) {
    myPeerId = id;
}

export function createLocalPlayer() {
    if (players[myPeerId]) return;
    // Color 0 for host (index 0 logic in network), or just default
    const color = CONFIG.colors[0]; 
    createOrUpdatePlayer(myPeerId, camera.position, camera.quaternion, color);
    players[myPeerId].isLocal = true;
    localPlayer.color = color;
}

// Player Entity Management
export function createOrUpdatePlayer(id, pos, rot, color) {
    let mesh;
    if (players[id]) {
        mesh = players[id].mesh;
    } else {
        // Mesh
        const geo = new THREE.CapsuleGeometry(1, 2, 4, 8);
        const mat = new THREE.MeshLambertMaterial({ color: color });
        mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        
        // Face
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0x000000}));
        face.position.set(0, 0.5, 0.6);
        mesh.add(face);
        
        // Light
        const light = new THREE.PointLight(color, 1, 15);
        light.position.set(0, 1, 0);
        mesh.add(light);

        scene.add(mesh);
        players[id] = { mesh, targetPos: null, targetRot: null, hp: 100, color };
    }
    
    if (pos) mesh.position.copy(pos);
    if (rot) mesh.quaternion.copy(rot);
    players[id].targetPos = mesh.position.clone();
    players[id].targetRot = mesh.quaternion.clone();
}

export function removePlayer(id) {
    if (players[id]) {
        scene.remove(players[id].mesh);
        delete players[id];
    }
}

// Physics
export function updatePhysics(delta) {
    if (!players[myPeerId]) return;

    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;
    velocity.y -= CONFIG.gravity * delta;

    direction.z = Number(moveState.forward) - Number(moveState.backward);
    direction.x = Number(moveState.right) - Number(moveState.left);
    direction.normalize();

    if (moveState.forward || moveState.backward) velocity.z -= direction.z * CONFIG.speed * delta * 5;
    if (moveState.left || moveState.right) velocity.x -= direction.x * CONFIG.speed * delta * 5;

    // Move X/Z
    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    // Wall Collision
    if (checkCollision(players[myPeerId].mesh.position)) {
        controls.moveRight(velocity.x * delta);
        controls.moveForward(velocity.z * delta);
        velocity.x = 0;
        velocity.z = 0;
    }

    // Move Y
    players[myPeerId].mesh.position.y += velocity.y * delta;

    if (players[myPeerId].mesh.position.y < 1.5) {
        velocity.y = 0;
        players[myPeerId].mesh.position.y = 1.5;
        canJump = true;
    } else {
        if (checkCollision(players[myPeerId].mesh.position)) {
            players[myPeerId].mesh.position.y -= velocity.y * delta;
            velocity.y = 0;
        }
    }

    // Sync Mesh to Camera
    players[myPeerId].mesh.position.copy(camera.position);
    players[myPeerId].mesh.quaternion.copy(camera.quaternion);

    // Network Sync
    sendUpdate();
}

function checkCollision(newPos) {
    if (newPos.y < 1) newPos.y = 1;
    const playerBox = new THREE.Box3().setFromCenterAndSize(newPos, new THREE.Vector3(1, 4, 1));
    for (let obj of worldObjects) {
        if (obj.geometry.type === 'PlaneGeometry') continue;
        const box = new THREE.Box3().setFromObject(obj);
        if (playerBox.intersectsBox(box)) return true;
    }
    return false;
}

// Combat
const raycaster = new THREE.Raycaster();

function shoot() {
    playSound('shoot');
    const origin = camera.position.clone();
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    createBulletTrail(origin, origin.clone().add(dir.multiplyScalar(100)));

    // Hitscan
    raycaster.set(origin, dir.clone().normalize());
    const targets = [];
    Object.keys(players).forEach(id => {
        if (id !== myPeerId && players[id].mesh.visible) targets.push(players[id].mesh);
    });

    const intersects = raycaster.intersectObjects(targets);
    if (intersects.length > 0) {
        const hitObj = intersects[0].object;
        const hitId = Object.keys(players).find(id => players[id].mesh === hitObj);
        if (hitId) {
            playSound('hit');
            showHitMarker();
            // Handled in network module to determine authority
            return { hit: true, targetId: hitId };
        }
    }
    return { hit: false };
}

export function takeDamage(amount) {
    localPlayer.hp -= amount;
    updateHUD(localPlayer.hp);
    
    // Red Flash
    const div = document.createElement('div');
    div.style.cssText = "position:absolute; top:0; left:0; width:100%; height:100%; background:red; opacity:0.3; pointer-events:none;";
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 100);

    if (localPlayer.hp <= 0) {
        die();
    }
}

function die() {
    playSound('hit'); // Reuse hit sound for death thud
    document.exitPointerLock();
    document.getElementById('respawn-screen').classList.remove('hidden');
    
    let timer = 3;
    const timerEl = document.getElementById('respawn-timer');
    const intv = setInterval(() => {
        timer--;
        timerEl.innerText = `Respawning in ${timer}...`;
        if (timer <= 0) {
            clearInterval(intv);
            respawn();
        }
    }, 1000);
}

function respawn() {
    localPlayer.hp = 100;
    updateHUD(100);
    document.getElementById('respawn-screen').classList.add('hidden');
    
    const angle = Math.random() * Math.PI * 2;
    camera.position.set(Math.cos(angle)*20, 2, Math.sin(angle)*20);
    players[myPeerId].mesh.position.copy(camera.position);
    
    document.body.requestPointerLock();
}

export function respawnRemotePlayer(id) {
    if (players[id]) {
        players[id].hp = 100;
        players[id].mesh.visible = true;
    }
}

// Interpolation for other players
export function interpolatePlayers() {
    const now = Date.now();
    Object.keys(players).forEach(id => {
        if (id === myPeerId) return;
        const p = players[id];
        if (p.targetPos) {
            p.mesh.position.lerp(p.targetPos, 0.2);
            p.mesh.quaternion.slerp(p.targetRot, 0.2);
        }
    });
}
