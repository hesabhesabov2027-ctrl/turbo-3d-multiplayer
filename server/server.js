
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static(path.join(__dirname, "../public")));

// Yalnız hazırda qoşulmuş oyunçular
const players = Object.create(null);

function getNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

io.on("connection", (socket) => {
  console.log("Oyunçu qoşuldu:", socket.id);

  players[socket.id] = {
    x: 0,
    z: 4,
    rotation: 0,
    speed: 0
  };

  // Yeni oyunçuya bütün hazırkı oyunçuları göndər
  socket.emit("players", players);

  // Digər oyunçulara yeni oyunçunu bildir
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    player: players[socket.id]
  });

  console.log("Aktiv oyunçular:", Object.keys(players).length);

  // Oyunçunun hərəkətini qəbul et
  socket.on("move", (data) => {
    if (!players[socket.id] || !data) return;

    players[socket.id] = {
      x: getNumber(data.x, 0),
      z: getNumber(data.z, 4),
      rotation: getNumber(data.rotation, 0),
      speed: Math.max(0, Math.min(200, getNumber(data.speed, 0)))
    };

    // Hərəkət məlumatını digər oyunçulara göndər
    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      player: players[socket.id]
    });
  });

  // Oyunçu çıxanda onu siyahıdan sil
  socket.on("disconnect", () => {
    delete players[socket.id];

    io.emit("playerLeft", socket.id);

    console.log("Oyunçu çıxdı:", socket.id);
    console.log("Aktiv oyunçular:", Object.keys(players).length);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
