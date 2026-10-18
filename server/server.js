const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "../public")));

const players = {};

io.on("connection", (socket) => {
  players[socket.id] = {
    x: 0,
    z: 0,
    rotation: 0
  };

  socket.emit("players", players);
  socket.broadcast.emit("playerJoined", {
    id: socket.id,
    player: players[socket.id]
  });

  socket.on("move", (data) => {
    if (!players[socket.id]) return;

    players[socket.id] = {
      x: Number(data.x) || 0,
      z: Number(data.z) || 0,
      rotation: Number(data.rotation) || 0
    };

    socket.broadcast.emit("playerMoved", {
      id: socket.id,
      player: players[socket.id]
    });
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("playerLeft", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server started on port " + PORT);
});
