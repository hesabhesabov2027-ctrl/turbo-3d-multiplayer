const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

app.use(express.static(path.join(__dirname, "../public")));

const players = {};

io.on("connection", (socket) => {
  console.log("Oyunçu qoşuldu:", socket.id);

  players[socket.id] = {
    x: 0,
    z: 4,
    rotation: 0
  };

  // Yeni oyunçuya hazırda qoşulmuş oyunçuları göndər
  socket.emit("players", players);

  // Digər oyunçulara yeni oyunçunu bildir
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    player: players[socket.id]
  });

  // Hərəkəti qəbul et və digər oyunçulara ötür
  socket.on("move", (data) => {
    if (!players[socket.id]) return;

    players[socket.id] = {
      x: Number(data.x) || 0,
      z: Number(data.z) || 4,
      rotation: Number(data.rotation) || 0
    };

    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      player: players[socket.id]
    });
  });

  // Oyunçu çıxanda siyahıdan sil
  socket.on("disconnect", () => {
    console.log("Oyunçu çıxdı:", socket.id);

    delete players[socket.id];

    io.emit("playerLeft", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
