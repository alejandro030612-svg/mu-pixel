import * as THREE from 'three';

// --- CONFIGURACIÓN BÁSICA ---
const scene = new THREE.Scene();
// Cielo oscuro "Lorencia"
scene.background = new THREE.Color(0x1a1a24); 
scene.fog = new THREE.FogExp2(0x1a1a24, 0.03); // Niebla oscura tipo MU

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Luces "Dark Fantasy"
const ambientLight = new THREE.AmbientLight(0x404050, 0.4); // Luz ambiente azulada oscura
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2); // Luz de luna/sol suave
dirLight.position.set(15, 30, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
scene.add(dirLight);

// --- TEXTURAS ---
const textureLoader = new THREE.TextureLoader();

// Textura del Suelo (Césped Oscuro)
const grassTex = textureLoader.load('./assets/grass.png');
grassTex.wrapS = THREE.RepeatWrapping;
grassTex.wrapT = THREE.RepeatWrapping;
grassTex.repeat.set(20, 20); // Repetir textura
// Evitar blur en pixel art
grassTex.magFilter = THREE.NearestFilter; 

const grassGeo = new THREE.PlaneGeometry(200, 200);
const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.9, metalness: 0 });
const grass = new THREE.Mesh(grassGeo, grassMat);
grass.rotation.x = -Math.PI / 2;
grass.receiveShadow = true;
scene.add(grass);

// --- PUEBLO LORENCIA (SAFE ZONE) ---
function buildTown() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1.0 });
    const wallGeo = new THREE.BoxGeometry(30, 2, 2);
    // Muro Norte
    const wN = new THREE.Mesh(wallGeo, wallMat); wN.position.set(0, 1, -15); scene.add(wN);
    // Muro Sur
    const wS = new THREE.Mesh(wallGeo, wallMat); wS.position.set(0, 1, 15); scene.add(wS);
    // Muro Este
    const wE = new THREE.Mesh(wallGeo, wallMat); wE.rotation.y = Math.PI/2; wE.position.set(15, 1, 0); scene.add(wE);
    // Muro Oeste
    const wW = new THREE.Mesh(wallGeo, wallMat); wW.rotation.y = Math.PI/2; wW.position.set(-15, 1, 0); scene.add(wW);

    // NPC: Lumen the Barmaid
    const lumenMat = new THREE.MeshStandardMaterial({ color: 0xffaaaa, roughness: 0.6 });
    const lumenDress = new THREE.MeshStandardMaterial({ color: 0x882222 });
    const lumen = new THREE.Object3D();
    const lBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.5), lumenDress); lBody.position.y = 1.4; lumen.add(lBody);
    const lHead = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), lumenMat); lHead.position.y = 2.4; lumen.add(lHead);
    lumen.position.set(3, 0, -3);
    
    // Tabla de Bar
    const tableMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), tableMat);
    table.position.set(3, 0.5, -2);
    
    scene.add(lumen);
    scene.add(table);
}
buildTown();

// Textura de Skin Dark Knight
const dkSkin = textureLoader.load('./assets/dk_skin.png');
dkSkin.magFilter = THREE.NearestFilter; // Pixel art crudo
const skinMat = new THREE.MeshStandardMaterial({ map: dkSkin, roughness: 0.5, metalness: 0.6 });

// --- EL JUGADOR "DARK KNIGHT" MEJORADO ---
const playerContainer = new THREE.Object3D();
scene.add(playerContainer);

const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
const head = new THREE.Mesh(headGeo, skinMat);
head.position.y = 2.4;
head.castShadow = true;
playerContainer.add(head);

const bodyGeo = new THREE.BoxGeometry(1.0, 1.2, 0.6);
const body = new THREE.Mesh(bodyGeo, skinMat);
body.position.y = 1.4;
body.castShadow = true;
playerContainer.add(body);

const armGeo = new THREE.BoxGeometry(0.4, 1.2, 0.4);
const leftArm = new THREE.Mesh(armGeo, skinMat);
leftArm.position.set(-0.7, 1.4, 0);
leftArm.castShadow = true;
playerContainer.add(leftArm);

const rightArm = new THREE.Mesh(armGeo, skinMat);
rightArm.position.set(0.7, 1.4, 0);
rightArm.castShadow = true;
playerContainer.add(rightArm);

const legGeo = new THREE.BoxGeometry(0.45, 1.2, 0.45);
const leftLeg = new THREE.Mesh(legGeo, skinMat);
leftLeg.position.set(-0.25, 0.6, 0);
leftLeg.castShadow = true;
playerContainer.add(leftLeg);

const rightLeg = new THREE.Mesh(legGeo, skinMat);
rightLeg.position.set(0.25, 0.6, 0);
rightLeg.castShadow = true;
playerContainer.add(rightLeg);

// Espada Brillante Voxel
const swordGeo = new THREE.BoxGeometry(0.1, 1.8, 0.3);
const swordMat = new THREE.MeshStandardMaterial({ color: 0xff0044, metalness: 0.8, roughness: 0.2, emissive: 0xaa0000 });
const sword = new THREE.Mesh(swordGeo, swordMat);
sword.position.set(0, -0.5, 0.6); // Pegada a la mano
sword.castShadow = true;
rightArm.add(sword);

// --- MECÁNICAS E INTERFAZ ---
let moveForward = 0;
let turnRight = 0;
const speed = 6;

function updateCamera() {
    camera.position.x = playerContainer.position.x;
    camera.position.z = playerContainer.position.z + 10;
    camera.position.y = playerContainer.position.y + 8;
    camera.lookAt(playerContainer.position);
}

// Joystick
const joyZone = document.getElementById('joy-zone');
const joystick = nipplejs.create({ zone: joyZone, mode: 'static', position: { left: '50%', top: '50%' }, color: '#ff2222' });
joystick.on('move', (evt, data) => { moveForward = Math.sin(data.angle.radian); turnRight = Math.cos(data.angle.radian); });
joystick.on('end', () => { moveForward = 0; turnRight = 0; });

let isAttacking = false;
const atkBtn = document.getElementById('action-button');
atkBtn.addEventListener('mousedown', () => isAttacking = true);
atkBtn.addEventListener('mouseup', () => isAttacking = false);
atkBtn.addEventListener('touchstart', (e) => { e.preventDefault(); isAttacking = true; });
atkBtn.addEventListener('touchend', (e) => { e.preventDefault(); isAttacking = false; });

// --- MULTIJUGADOR ---
const otherPlayers = {};
let socket = null;
try {
    socket = new WebSocket(`ws://${window.location.hostname}:8765`);
    socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'state') {
            const svrPlayers = data.players;
            for (let id in svrPlayers) {
                if (id === data.myId) continue;
                if (!otherPlayers[id]) {
                    const clone = playerContainer.clone();
                    scene.add(clone);
                    otherPlayers[id] = clone;
                }
                otherPlayers[id].position.set(svrPlayers[id].x, svrPlayers[id].y, svrPlayers[id].z);
                otherPlayers[id].rotation.y = svrPlayers[id].rotY;
            }
            for (let id in otherPlayers) {
                if (!svrPlayers[id]) { scene.remove(otherPlayers[id]); delete otherPlayers[id]; }
            }
        }
    };
} catch(e) {}

// --- LOOP ---
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    if (moveForward !== 0 || turnRight !== 0) {
        playerContainer.rotation.y = Math.atan2(-turnRight, moveForward);
        const dist = speed * dt;
        playerContainer.position.x += turnRight * dist;
        playerContainer.position.z -= moveForward * dist;
        
        // Caminar
        const t = clock.getElapsedTime();
        leftArm.rotation.x = Math.sin(t * 12) * 0.6;
        rightArm.rotation.x = -Math.sin(t * 12) * 0.6;
        leftLeg.rotation.x = -Math.sin(t * 12) * 0.6;
        rightLeg.rotation.x = Math.sin(t * 12) * 0.6;
    } else {
        leftLeg.rotation.x = 0; rightLeg.rotation.x = 0; leftArm.rotation.x = 0;
        if (!isAttacking) rightArm.rotation.x = 0;
    }
    
    // Ataque
    if (isAttacking) rightArm.rotation.x = -Math.PI / 2.5;

    updateCamera();
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            x: playerContainer.position.x, y: playerContainer.position.y, z: playerContainer.position.z, rotY: playerContainer.rotation.y
        }));
    }

    renderer.render(scene, camera);
}
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});
animate();
