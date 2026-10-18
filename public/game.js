import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";

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

scene.add(new THREE.HemisphereLight(0xffffff, 0x466644, 2));

const sun = new THREE.DirectionalLight(0xffffff, 2);
sun.position.set(-5, 15, 8);
sun.castShadow = true;
scene.add(sun);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(200, 300),
  new THREE.MeshStandardMaterial({ color: 0x328b42 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.z = -60;
ground.receiveShadow = true;
scene.add(ground);

const road = new THREE.Mesh(
  new THREE.PlaneGeometry(12, 300),
  new THREE.MeshStandardMaterial({ color: 0x33343a })
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0.02, -60);
scene.add(road);

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
  body.castShadow = true;
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

const myCar = makeCar(0xff3028);
myCar.position.set(0, 0, 4);

const socket = io();
const otherCars = {};
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

socket.on("connect", () => {
  status.textContent = "Serverə qoşuldu!";
});

socket.on("connect_error", () => {
  status.textContent = "Server hələ işə salınmayıb.";
});

socket.on("players", players => {
  for (const id in players) {
    if (id !== socket.id && !otherCars[id]) {
      otherCars[id] = makeCar(0x2288ff);
    }
    if (id !== socket.id && otherCars[id]) {
      otherCars[id].position.set(
        players[id].x,
        0,
        players[id].z
      );
    }
  }
  updatePlayerCount();
});

socket.on("playerJoined", data => {
  if (data.id !== socket.id && !otherCars[data.id]) {
    otherCars[data.id] = makeCar(0x2288ff);
    otherCars[data.id].position.set(data.player.x, 0, data.player.z);
  }
  updatePlayerCount();
});

socket.on("playerMoved", data => {
  const car = otherCars[data.id];
  if (car) {
    car.position.x = data.player.x;
    car.position.z = data.player.z;
    car.rotation.y = data.player.rotation;
  }
});

socket.on("playerLeft", id => {
  if (otherCars[id]) {
    scene.remove(otherCars[id]);
    delete otherCars[id];
  }
  updatePlayerCount();
});

function updatePlayerCount() {
  playersLabel.textContent = "Oyunçular: " + (1 + Object.keys(otherCars).length);
}

document.getElementById("start").addEventListener("click", () => {
  running = true;
  menu.style.display = "none";
});

function bindButton(id, setter) {
  const button = document.getElementById(id);
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    setter(true);
  });
  for (const eventName of ["pointerup", "pointercancel", "pointerleave"]) {
    button.addEventListener(eventName, () => setter(false));
  }
}

bindButton("left", value => left = value);
bindButton("right", value => right = value);
bindButton("gas", value => gas = value);

window.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "a") left = true;
  if (event.key === "ArrowRight" || event.key === "d") right = true;
  if (event.key === "ArrowUp" || event.key === "w") gas = true;
});

window.addEventListener("keyup", event => {
  if (event.key === "ArrowLeft" || event.key === "a") left = false;
  if (event.key === "ArrowRight" || event.key === "d") right = false;
  if (event.key === "ArrowUp" || event.key === "w") gas = false;
});

const clock = new THREE.Clock();
let sendTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (running) {
    speed = gas ? Math.min(speed + 22 * dt, 45) : Math.max(speed - 12 * dt, 0);

    if (left) x -= 5 * dt;
    if (right) x += 5 * dt;
    x = THREE.MathUtils.clamp(x, -4.5, 4.5);

    myCar.position.x = x;
    myCar.position.z = 4;

    for (const line of markings) {
      line.position.z += speed * dt;
      if (line.position.z > 12) line.position.z -= 208;
    }

    sendTimer += dt;
    if (sendTimer > 0.08 && socket.connected) {
      socket.emit("move", { x, z: 4, rotation: 0 });
      sendTimer = 0;
    }
  }

  camera.position.lerp(
    new THREE.Vector3(x * 0.45, 5.5, 12),
    0.08
  );
  camera.lookAt(x * 0.3, 0.5, -5);

  speedLabel.textContent = "Sürət: " + Math.round(speed);
  renderer.render(scene, camera);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
