
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

// ==============================
// SƏHNƏ
// ==============================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 35, 150);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  300
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// ==============================
// İŞIQLAR
// ==============================
scene.add(new THREE.HemisphereLight(0xffffff, 0x466644, 2));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(-5, 15, 8);
sun.castShadow = true;
scene.add(sun);

// ==============================
// TORPAQ
// ==============================
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 300),
  new THREE.MeshStandardMaterial({ color: 0x328b42 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -60;
scene.add(ground);

// ==============================
// YOL
// ==============================
const road = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 300),
  new THREE.MeshStandardMaterial({ color: 0x33343a })
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.02, -60);
scene.add(road);

// ==============================
// YOL XƏTLƏRİ
// ==============================
const markings = [];

for (let z = 10; z > -200; z -= 8) {
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.035, 3.5),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );

  line.position.set(0, 0.06, z);
  scene.add(line);
  markings.push(line);
}

// ==============================
// MAŞIN YARAT
// ==============================
function makeCar(color) {
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.55, 3),
    new THREE.MeshStandardMaterial({
      color,
      metalness: 0.25,
      roughness: 0.35
    })
  );
  body.position.y = 0.65;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.15, 0.55, 1.35),
    new THREE.MeshStandardMaterial({
      color: 0x9ce5ff,
      metalness: 0.4,
      roughness: 0.2
    })
  );
  cabin.position.set(0, 1.15, -0.15);
  car.add(cabin);

  for (const x of [-0.85, 0.85]) {
    for (const z of [-0.95, 0.95]) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, 0.22, 16),
        new THREE.MeshStandardMaterial({ color: 0x111111 })
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.35, z);
      car.add(wheel);
    }
  }

  car.traverse(obj => {
    if (obj.isMesh) obj.castShadow = true;
  });

  scene.add(car);
  return car;
}

// ==============================
// SƏNİN MAŞININ
// ==============================
const myCar = makeCar(0xff3028);
myCar.position.set(0, 0, 4);

// ==============================
// MULTIPLAYER
// ==============================
const socket = io();

const otherCars = Object.create(null);
const targetPositions = Object.create(null);

let x = 0;
let speed = 0;
let running = false;
let left = false;
let right = false;
let gas = false;

const menu = document.getElementById("menu");
const status = document.getElementById("status");
const speedLabel = document.getElementById("speed");
const playersLabel = document.getElementById("players");

// ==============================
// OYUNÇU SAYI
// ==============================
function updatePlayerCount() {
  const count =
    Object.keys(otherCars).length + (socket.connected ? 1 : 0);

  if (playersLabel) {
    playersLabel.textContent = "Oyunçular: " + count;
  }
}

// ==============================
// DİGƏR OYUNÇUNU YARAT
// ==============================
function addOtherPlayer(id, player) {
  if (!id || id === socket.id) return;

  if (!otherCars[id]) {
    otherCars[id] = makeCar(0x2288ff);
  }

  const p = player || {};

  targetPositions[id] = {
    x: Number(p.x) || 0,
    z: Number(p.z) || 4,
    rotation: Number(p.rotation) || 0,
    speed: Math.max(0, Number(p.speed) || 0)
  };

  updatePlayerCount();
}

// ==============================
// SERVERƏ QOŞULMA
// ==============================
socket.on("connect", () => {
  if (status) status.textContent = "Serverə qoşuldu!";
  updatePlayerCount();
});

socket.on("disconnect", () => {
  if (status) status.textContent = "Serverdən ayrıldı.";
  updatePlayerCount();
});

socket.on("connect_error", error => {
  if (status) {
    status.textContent = "Qoşulma xətası: " + error.message;
  }
});

// ==============================
// MÖVCUD OYUNÇULAR
// ==============================
socket.on("players", players => {
  for (const id in otherCars) {
    scene.remove(otherCars[id]);
    delete otherCars[id];
    delete targetPositions[id];
  }

  for (const id in players) {
    if (id !== socket.id) {
      addOtherPlayer(id, players[id]);
    }
  }

  updatePlayerCount();
});

// ==============================
// YENİ OYUNÇU
// ==============================
socket.on("playerJoined", data => {
  if (data) {
    addOtherPlayer(data.id, data.player);
  }
});

// ==============================
// DİGƏR MAŞININ HƏRƏKƏTİ
// ==============================
socket.on("playerMoved", data => {
  if (!data || !data.id || data.id === socket.id) return;

  const p = data.player || {};

  if (!otherCars[data.id]) {
    addOtherPlayer(data.id, p);
  }

  targetPositions[data.id] = {
    x: Number.isFinite(Number(p.x)) ? Number(p.x) : 0,
    z: Number.isFinite(Number(p.z)) ? Number(p.z) : 4,
    rotation: Number.isFinite(Number(p.rotation))
      ? Number(p.rotation)
      : 0,
    speed: Math.max(0, Number(p.speed) || 0)
  };
});

// ==============================
// OYUNÇU ÇIXDI
// ==============================
socket.on("playerLeft", id => {
  if (otherCars[id]) {
    scene.remove(otherCars[id]);
    delete otherCars[id];
  }

  delete targetPositions[id];
  updatePlayerCount();
});

// ==============================
// OYUNA BAŞLA
// ==============================
const startButton = document.getElementById("start");

if (startButton) {
  startButton.addEventListener("click", () => {
    running = true;
    if (menu) menu.style.display = "none";
  });
}

// ==============================
// TELEFON DÜYMƏLƏRİ
// ==============================
function bindButton(id, setter) {
  const button = document.getElementById(id);
  if (!button) return;

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    setter(true);
  });

  for (const eventName of [
    "pointerup",
    "pointercancel",
    "pointerleave"
  ]) {
    button.addEventListener(eventName, () => setter(false));
  }
}

bindButton("left", value => left = value);
bindButton("right", value => right = value);
bindButton("gas", value => gas = value);

// ==============================
// KLAVİATURA
// ==============================
window.addEventListener("keydown", event => {
  const key = event.key.toLowerCase();

  if (key === "arrowleft" || key === "a") left = true;
  if (key === "arrowright" || key === "d") right = true;
  if (key === "arrowup" || key === "w") gas = true;
});

window.addEventListener("keyup", event => {
  const key = event.key.toLowerCase();

  if (key === "arrowleft" || key === "a") left = false;
  if (key === "arrowright" || key === "d") right = false;
  if (key === "arrowup" || key === "w") gas = false;
});

// ==============================
// OYUN DÖVRÜ
// ==============================
const clock = new THREE.Clock();
let sendTimer = 0;

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (running) {
    speed = gas
      ? Math.min(speed + 22 * dt, 45)
      : Math.max(speed - 12 * dt, 0);

    if (left) x -= 5 * dt;
    if (right) x += 5 * dt;

    x = THREE.MathUtils.clamp(x, -4.5, 4.5);

    myCar.position.x = x;
    myCar.position.z = 4;

    // ÖZ YOLUMUZUN XƏTLƏRİ
    for (const line of markings) {
      line.position.z += speed * dt;

      if (line.position.z > 12) {
        line.position.z -= 208;
      }
    }

    // MAŞININ DÖNMƏSİ
    const steering = (right ? 1 : 0) - (left ? 1 : 0);
    myCar.rotation.y = -steering * 0.08;

    // SERVERƏ HƏRƏKƏT GÖNDƏR
    sendTimer += dt;

    if (sendTimer >= 0.05 && socket.connected) {
      socket.emit("move", {
        x: myCar.position.x,
        z: myCar.position.z,
        rotation: myCar.rotation.y,
        speed: speed
      });

      sendTimer = 0;
    }
  }

  // DİGƏR OYUNÇULARIN MAŞINLARI
  for (const id in otherCars) {
    const car = otherCars[id];
    const target = targetPositions[id];

    if (!target) continue;

    car.position.x = THREE.MathUtils.lerp(
      car.position.x,
      target.x,
      Math.min(1, 10 * dt)
    );

    car.position.z = THREE.MathUtils.lerp(
      car.position.z,
      target.z,
      Math.min(1, 10 * dt)
    );

    const angleDifference = Math.atan2(
      Math.sin(target.rotation - car.rotation.y),
      Math.cos(target.rotation - car.rotation.y)
    );

    car.rotation.y += angleDifference * Math.min(1, 10 * dt);
  }

  // KAMERA
  camera.position.lerp(
    new THREE.Vector3(x * 0.45, 5.5, 12),
    0.08
  );

  camera.lookAt(x * 0.3, 0.5, -5);

  if (speedLabel) {
    speedLabel.textContent = "Sürət: " + Math.round(speed);
  }

  renderer.render(scene, camera);
}

// ==============================
// EKRAN ÖLÇÜSÜ
// ==============================
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
