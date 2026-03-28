import * as THREE from 'three';

// --- CONFIGURACIÓN BÁSICA ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a24); 
scene.fog = new THREE.FogExp2(0x1a1a24, 0.03);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0x404050, 0.4);
scene.add(ambientLight);
const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
dirLight.position.set(15, 30, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- CÉSPED ---
const texLoader = new THREE.TextureLoader();
const grassTex = texLoader.load('./assets/grass.png');
grassTex.wrapS = THREE.RepeatWrapping; grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(20, 20); grassTex.magFilter = THREE.NearestFilter; 
const grassgeo = new THREE.PlaneGeometry(200, 200);
const grass = new THREE.Mesh(grassgeo, new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9 }));
grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
scene.add(grass);

// --- SKINS Y MATERIALES ---
const dkSkin = texLoader.load('./assets/dk_skin.png');
dkSkin.magFilter = THREE.NearestFilter;
const skinMat = new THREE.MeshStandardMaterial({ map: dkSkin, roughness: 0.5 });
const redMat = new THREE.MeshStandardMaterial({ color: 0x8b0000 }); // Arañas rojas
const pinkBling = new THREE.MeshStandardMaterial({ color: 0xff66cc, emissive: 0x880044, roughness: 0.1, metalness: 0.9 }); // Drops de Joyas

// --- SONIDOS SINTETIZADOS (API WEB) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playDing() {
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Tono alto
    gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
    osc.start(); osc.stop(audioCtx.currentTime + 1);
}

// --- JUGADOR PRINCIPAL ---
const playerContainer = new THREE.Object3D(); scene.add(playerContainer);

const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat); head.position.y = 2.4; head.castShadow = true; playerContainer.add(head);
const body = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.6), skinMat); body.position.y = 1.4; body.castShadow = true; playerContainer.add(body);
const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), skinMat); lArm.position.set(-0.7, 1.4, 0); lArm.castShadow = true; playerContainer.add(lArm);
const rArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), skinMat); rArm.position.set(0.7, 1.4, 0); rArm.castShadow = true; playerContainer.add(rArm);
const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), skinMat); lLeg.position.set(-0.25, 0.6, 0); lLeg.castShadow = true; playerContainer.add(lLeg);
const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.2, 0.45), skinMat); rLeg.position.set(0.25, 0.6, 0); rLeg.castShadow = true; playerContainer.add(rLeg);

const mxSword = new THREE.MeshStandardMaterial({ color: 0xff0044, metalness: 0.8, roughness: 0.2, emissive: 0xaa0000 });
const sword = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.8, 0.3), mxSword);
sword.position.set(0, -0.5, 0.6); sword.castShadow = true; rArm.add(sword);

// Creador Visual de Monstruos
function createSpider() {
    const s = new THREE.Object3D();
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.8, 1.5), redMat); b.position.y = 0.4; b.castShadow = true; s.add(b);
    return s;
}

// Creador Visual de Drops (Jewel of Bless)
function createJewel() {
    const j = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), pinkBling);
    j.position.y = 0.2;
    // Agregamos una lucecita magenta para que resalte
    const spot = new THREE.PointLight(0xff66cc, 1.5, 3);
    j.add(spot);
    return j;
}

// --- CONTROLES Y CÁMARA ---
let moveForward = 0; let turnRight = 0; const speed = 6;
const joyZone = document.getElementById('joy-zone');
const joystick = nipplejs.create({ zone: joyZone, mode: 'static', position: { left: '50%', top: '50%' }, color: '#ff2222' });
joystick.on('move', (evt, data) => { moveForward = Math.sin(data.angle.radian); turnRight = Math.cos(data.angle.radian); });
joystick.on('end', () => { moveForward = 0; turnRight = 0; });

let isAttacking = false;
let lastAttackTime = 0;
const atkBtn = document.getElementById('action-button');
const handleAtk = (e) => { e.preventDefault(); isAttacking = true; if(audioCtx.state === 'suspended') audioCtx.resume(); };
atkBtn.addEventListener('mousedown', handleAtk);
atkBtn.addEventListener('mouseup', () => isAttacking = false);
atkBtn.addEventListener('touchstart', handleAtk);
atkBtn.addEventListener('touchend', () => isAttacking = false);

// --- ESTADO Y MULTIJUGADOR ---
let socket = null;
const otherPlayers = {};
const renderedMonsters = {};
const renderedDrops = {};

// UI References
const hpEl = document.querySelector('.hp-globe');
const topBar = document.querySelector('.top-bar');

let myNetworkId = null;

try {
    socket = new WebSocket(`ws://${window.location.hostname}:8765`);
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'init') {
            myNetworkId = data.myId;
        }

        if(data.type === 'levelup') {
            topBar.innerHTML = `Loc: Lorencia<br/>LVL: ${data.level} <span style="color:yellow">(LVL UP!)</span>`;
            playDing();
        }

        if (data.type === 'state') {
            const serverState = data;
            
            // 1. Actualizar MI Player Stats UI
            if(myNetworkId && serverState.players[myNetworkId]) {
                const me = serverState.players[myNetworkId];
                hpEl.innerHTML = `${Math.floor(me.hp)}<br><small>HP</small>`;
                topBar.innerHTML = `Loc: Lorencia<br/>LVL: ${me.level}`;
            }

            // 2. Jugadores (Clones)
            for (let id in serverState.players) {
                if (id === myNetworkId) continue;
                if (!otherPlayers[id]) { const clone = playerContainer.clone(); scene.add(clone); otherPlayers[id] = clone; }
                otherPlayers[id].position.set(serverState.players[id].x, serverState.players[id].y, serverState.players[id].z);
                otherPlayers[id].rotation.y = serverState.players[id].rotY;
            }
            for (let id in otherPlayers) { if (!serverState.players[id]) { scene.remove(otherPlayers[id]); delete otherPlayers[id]; } }
            
            // 3. Monstruos (Arañas)
            for (let id in serverState.monsters) {
                const sm = serverState.monsters[id];
                if (!renderedMonsters[id]) {
                    const spider = createSpider(); scene.add(spider);
                    renderedMonsters[id] = spider;
                }
                renderedMonsters[id].position.set(sm.x, sm.y, sm.z);
            }
            for (let id in renderedMonsters) {
                if (!serverState.monsters[id]) {
                    scene.remove(renderedMonsters[id]); delete renderedMonsters[id];
                }
            }

            // 4. Drops (Suelo)
            for (let id in serverState.drops) {
                const drop = serverState.drops[id];
                if (!renderedDrops[id]) {
                    const jewel = createJewel(); scene.add(jewel);
                    renderedDrops[id] = jewel;
                    playDing(); // Ding de alerta botín
                }
                renderedDrops[id].position.set(drop.x, drop.y, drop.z);
            }
            for (let id in renderedDrops) {
                if (!serverState.drops[id]) {
                    scene.remove(renderedDrops[id]); delete renderedDrops[id];
                }
            }
        }
    };
} catch(e) {}

// --- LOOP ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const t = clock.getElapsedTime();

    // Animaciones
    for(let id in renderedDrops) {
        renderedDrops[id].rotation.y += dt * 3; // Joyas girando
    }

    // Movimiento Jugador
    if (moveForward !== 0 || turnRight !== 0) {
        playerContainer.rotation.y = Math.atan2(-turnRight, moveForward);
        const dist = speed * dt;
        playerContainer.position.x += turnRight * dist;
        playerContainer.position.z -= moveForward * dist;
        
        lArm.rotation.x = Math.sin(t * 12) * 0.6; rArm.rotation.x = -Math.sin(t * 12) * 0.6;
        lLeg.rotation.x = -Math.sin(t * 12) * 0.6; rLeg.rotation.x = Math.sin(t * 12) * 0.6;
    } else {
        lLeg.rotation.x = 0; rLeg.rotation.x = 0; lArm.rotation.x = 0;
        if (!isAttacking) rArm.rotation.x = 0;
    }
    
    // Combate
    if (isAttacking) {
        rArm.rotation.x = -Math.PI / 2.5; // Pose de espada arriba
        if (socket && socket.readyState === WebSocket.OPEN && t - lastAttackTime > 0.5) { // 1 atk por 0.5 seg
            socket.send(JSON.stringify({ type: "attack", x: playerContainer.position.x, z: playerContainer.position.z }));
            lastAttackTime = t;
        }
    }

    camera.position.set(playerContainer.position.x, playerContainer.position.y + 8, playerContainer.position.z + 10);
    camera.lookAt(playerContainer.position);
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "move", x: playerContainer.position.x, y: playerContainer.position.y, z: playerContainer.position.z, rotY: playerContainer.rotation.y }));
    }
    renderer.render(scene, camera);
}
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });
animate();
