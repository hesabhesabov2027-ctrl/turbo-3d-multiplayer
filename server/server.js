
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(express.static(path.join(__dirname, "../public")));

const players = Object.create(null);

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

io.on("connection", (socket) => {
  console.log("Qoşuldu:", socket.id);

  players[socket.id] = {
    x: 0,
    z: 4,
    rotation: 0,
    speed: 0
  };

  // Yeni oyunçuya mövcud oyunçuları göndər
  socket.emit("players", players);

  // Digər oyunçulara yeni oyunçunu bildir
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    player: players[socket.id]
  });

  console.log("Aktiv oyunçu sayı:", Object.keys(players).length);

  socket.on("move", (data) => {
    if (!players[socket.id] || !data) return;

    players[socket.id] = {
      x: safeNumber(data.x),
      z: safeNumber(data.z, 4),
      rotation: safeNumber(data.rotation),
      speed: Math.max(0, Math.min(45, safeNumber(data.speed)))
    };

    // Hərəkəti bütün digər oyunçulara ötür
    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      player: players[socket.id]
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];

    io.emit("playerLeft", socket.id);

    console.log("Ayrıldı:", socket.id);
    console.log("Aktiv oyunçu sayı:", Object.keys(players).length);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
