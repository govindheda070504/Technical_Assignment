const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


const rooms = {};

wss.on('connection', (ws) => {
  console.log("New WebSocket connection established.");

  ws.on('message', (message) => {
    const text = message.toString();
    console.log("Raw WebSocket message received:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error('Invalid JSON:', e);
      return;
    }

    const { type, room, payload } = data;

    switch (type) {
      case 'join':
        if (!rooms[room]) {
          rooms[room] = [];
        }
        rooms[room].push(ws);
        ws.room = room;

        console.log(`User joined room: ${room}. Total clients in room: ${rooms[room].length}`);


        rooms[room].forEach(client => {
          if (client !== ws) {
            client.send(JSON.stringify({ type: 'user-joined' }));
          }
        });
        break;

      case 'signal':
        console.log(`Relaying signal in room: ${room}`);
        rooms[room].forEach(client => {
          if (client !== ws) {
            client.send(JSON.stringify({ type: 'signal', payload }));
          }
        });
        break;
    }
  });

  ws.on('close', () => {
    const room = ws.room;
    if (room && rooms[room]) {
      rooms[room] = rooms[room].filter(client => client !== ws);
      console.log(`User disconnected from room: ${room}. Remaining clients: ${rooms[room].length}`);


      rooms[room].forEach(client => {
        client.send(JSON.stringify({ type: 'user-left' }));
      });


      if (rooms[room].length === 0) {
        delete rooms[room];
        console.log(`Room ${room} deleted.`);
      }
    } else {
      console.log("User disconnected ");
    }
  });
});


app.use(express.static(path.join(__dirname, '../frontend/public')));


app.get('/check-room', (req, res) => {
  const roomId = req.query.room;
  if (rooms[roomId]) {
    res.status(200).json({ exists: true });
  } else {
    res.status(404).json({ exists: false });
  }
});


server.listen(3000, () => console.log('Server running on http://localhost:3000'));
