"use strict";
const url = require('url');
const express = require('express');
const server = require('http').createServer();
const WSS = require('ws').Server;
const sendHeartbeats = require('ws-heartbeats');
const wss = new WSS({ server: server });
const app = express();

const bodyParser = require('body-parser');

app.use(bodyParser.json());

if (!process.env.DEBUG) {
  console.log("Using minifier.");
  const minify = require('express-minify');

  app.use((req, res, next) => {
    if (!/(three|vehicle|physi)\.js$/.test(req.url)) {
      res._no_minify = true;
    }
    next();
  });

  app.use(minify());
}

app.use(express.static('public'));

wss.on('connection', (ws) => {
  sendHeartbeats(ws);
  let loc = url.parse(ws.upgradeReq.url, true);
  let path = loc.pathname;
  if (path.charAt(0) == '/') path = path.slice(1);
  let parts = path.split('/', 2);
  let room = loc.query.room || '';

  console.log("Connected: ", path, loc.query);

  if (!(parts[0] === 'read' || parts[0] === 'write')) {
    ws.send("invalidEndpoint");
    ws.close();
  }

  let mode = parts[0], endpoint = parts[1];

  if (mode === 'read') {
    ws.endpoint = endpoint;
    ws.room = loc.query.room || '';
  } else if (mode === 'write') {
    ws.on('message', (msg) => {
      // broadcast message
      wss.clients.forEach((client) => {
        if (typeof client.endpoint === "string"
            && typeof client.room === "string"
            && client.readyState === client.OPEN
            && endpoint === client.endpoint
            && room === client.room) {
          //console.log("Send: ", endpoint, room, "=>", client.endpoint, client.room);
          client.send(msg);
        }
      });
    });
  } else {
    console.error('Invalid mode: ', mode)
  }
});

server.on('request', app);
server.listen(process.env.PORT || 8080, () => {
  console.log("Server started.");
});
