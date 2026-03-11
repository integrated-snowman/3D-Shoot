import * as THREE from 'three';

// Scene Globals
export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.02);

export const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const canvas = document.querySelector('#game-canvas');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// World Objects (for collision)
export const worldObjects = [];

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(50, 100, 50);
dirLight.castShadow = true;
scene.add(dirLight);

// Map Generation
export function initWorld() {
    // Floor Grid
    const gridHelper = new THREE.GridHelper(120, 40, 0x00f3ff, 0x222222);
    scene.add(gridHelper);
    
    const floorGeo = new THREE.PlaneGeometry(120, 120);
    const floorMat = new THREE.MeshLambertMaterial({ color: 0x0a0a15 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    worldObjects.push(floor);

    // Obstacles
    const boxGeo = new THREE.BoxGeometry(5, 5, 5);
    const boxMat = new THREE.MeshLambertMaterial({ color: 0xbc13fe, emissive: 0x220044 });
    
    for (let i = 0; i < 20; i++) {
        const box = new THREE.Mesh(boxGeo, boxMat);
        let x = (Math.random() - 0.5) * 100;
        let z = (Math.random() - 0.5) * 100;
        
        // Keep center clear
        if (Math.abs(x) < 10 && Math.abs(z) < 10) continue; 

        box.position.set(x, 2.5, z);
        box.castShadow = true;
        box.receiveShadow = true;
        scene.add(box);
        worldObjects.push(box);
    }
}

// Visual Effects
export function createBulletTrail(start, end) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({ color: 0x00f3ff, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    
    let op = 0.8;
    const anim = () => {
        op -= 0.1;
        mat.opacity = op;
        if (op <= 0) {
            scene.remove(line);
            geo.dispose();
            mat.dispose();
        } else {
            requestAnimationFrame(anim);
        }
    };
    anim();
}
