const crypto = require("crypto");
const WebSocket = require("ws").Server;
const express = require("express");
const { createServer } = require("http");
const GameServer = require("./schema");
const mongoose = require("mongoose");
var application = express();
var fs = require('fs');
const BAN_FILE = 'ip.json';
var webapp = express();
const wss = new WebSocket({
  server: application.listen(442, () =>
    console.log(`Matchmaker 3.0 started listening on port 442`)
  ),
});

let players = 0;
const HEARTBEAT_INTERVAL = 3000; // 3 seconds in ms
const BAN_THRESHOLD = 20; // Maximum number of connections.
const TIME_WINDOW = 5000; // Time window in milliseconds (5 seconds).

const ipConnectionMap = new Map();

let playersids = [];

mongoose
  .connect(
    "mongodb+srv://EON:RVHway8p4hD9w3c@eonmms.hvl3dud.mongodb.net/?retryWrites=true&w=majority",
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => {
    console.log("[Mongoose] Connected");
  })
  .catch((err) => {
    console.log(`[Mongoose] Failed -> ${err}`);
  });

async function Connecting(ws, ticketId, sessionId, matchId, region, playlist) {
  async function WsSend() {
    try {
      players++;
      if (players == -1) {
        players = players + 2;
      }
      await GameServer.updateOne(
        { name: region },
        { $set: { playerCount: players } }
      );
      console.log(region + playlist + sessionId + matchId);
      // await WatchRegion(ws, ticketId, sessionId, matchId);
      await WatchEU(ws, ticketId, sessionId, matchId);
      // await WatchNA(ws, ticketId, sessionId, matchId);
      console.log(`new players: ${players}`);
    } catch (error) {
      console.error(`Error occurred while updating player count: ${error}`);
    } finally {
      ws.send(
        JSON.stringify({
          payload: {
            state: "Connecting",
          },
          name: "StatusUpdate",
        })
      );
    }
  }
  setTimeout(WsSend, 600);
}
function Waiting(ws) {
  function WsSend() {
    ws.send(
      JSON.stringify({
        payload: {
          totalPlayers: players,
          connectedPlayers: players,
          state: "Waiting",
        },
        name: "StatusUpdate",
      })
    );
  }
  setTimeout(WsSend, 1000);
}
function Queued(ws, ticketId, sessionId, matchId) {
  //console.log('2: ' + online);
  //if (online == true) {
  //this.SessionAssignment(ws, matchId);
  //this.Join(ws, matchId, sessionId);
  //} else {
  setTimeout(function () {
    ws.send(
      JSON.stringify({
        payload: {
          ticketId: ticketId,
          queuedPlayers: parseInt(players),
          estimatedWaitSec: 3,
          status: {},
          state: "Queued",
        },
        name: "StatusUpdate",
      })
    );
  }, 2000);
  //}
}

/*function Queued(ws, ticketId, sessionId, matchId) {
    function WsSend() {
        ws.send(JSON.stringify({
            "payload": {
                ticketId: ticketId,
                queuedPlayers: parseInt(players),
                estimatedWaitSec: 3,
                status: {},
                state: "Queued",
            },
            "name": "StatusUpdate"
        }))
    }
    setTimeout(WsSend, 2000);
}*/

function SessionAssignment(ws, matchId) {
  function WsSend() {
    ws.send(
      JSON.stringify({
        payload: {
          matchId: matchId,
          state: "SessionAssignment",
        },
        name: "StatusUpdate",
      })
    );
  }
  WsSend();
}

function Join(ws, matchId, sessionId) {
  function WsSend() {
    ws.send(
      JSON.stringify({
        payload: {
          matchId: matchId,
          sessionId: sessionId,
          ip: "wowww",
          joinDelaySec: 1,
        },
        name: "Play",
      })
    );
  }
  online = false;
  WsSend();
}

// NA
async function WatchNA(ws, ticketId, sessionId, matchId) {
  // wait
  setInterval(async () => {
    GameServer.find({ region: "NA" })
      .then((documents) => {
        documents.forEach((doc) => {
          if (doc.status == "online") {
            setTimeout(function () {
              SessionAssignment(ws, matchId);
            }, 1000);

            setTimeout(function () {
              Join(ws, matchId, sessionId);
            }, 2000);
          }
        });
      })
      .catch((err) => {
        console.error(err);
      });

    setTimeout(function () {
      Queued(ws, ticketId);
    }, 1000);
  }, HEARTBEAT_INTERVAL);
}

async function WatchEU(ws, ticketId, sessionId, matchId) {
  setInterval(async () => {
    //console.log("ABC IDK DDD");
    GameServer.find({ region: "EU" })
      .then((documents) => {
        documents.forEach((doc) => {
          if (doc.status == "online") {
            setTimeout(function () {
              SessionAssignment(ws, matchId);
            }, 1000);

            setTimeout(function () {
              Join(ws, matchId, sessionId);
            }, 2000);
          }
        });
      })
      .catch((err) => {
        console.error(err);
      });

    setTimeout(function () {
      Queued(ws, ticketId);
    }, 1000);
  }, HEARTBEAT_INTERVAL);
}

// update this

async function WatchRegion(ws, ticketId, sessionId, matchId, region) {
  // wait
  let region1 = "";

  if (region == "NAE") {
    region1 = "NA";
  } else {
    region1 = region;
  }

  if (region == "EU") {
    region1 = "EU";
  } else {
    region1 = region;
  }

  setInterval(async () => {
    //console.log("aaa");
    GameServer.find({ region: region1 })
      .then((documents) => {
        documents.forEach((doc) => {
          if (doc.status == "online") {
            setTimeout(function () {
              SessionAssignment(ws, matchId);
            }, 1000);

            setTimeout(function () {
              Join(ws, matchId, sessionId);
            }, 2000);
          }
        });
      })
      .catch((err) => {
        console.error(err);
      });

    setTimeout(function () {
      Queued(ws, ticketId);
    }, 1000);
  }, HEARTBEAT_INTERVAL);
}

function BlockRiftEraKid(ws) {
  function WsSend() {
    ws.send(
      JSON.stringify({
        message: "Hey rift or era kids! get blocked <3"
      })
    );
  }
  WsSend();
}

function loadBannedIPs() {
  try {
    const data = fs.readFileSync(BAN_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // Handle file read errors or invalid JSON gracefully.
    console.error('Error reading banned IPs:', err);
    return [];
  }
}

class Matchmaker {
  constructor() {
    // ids maybe need to be changed...
    this.ticketId = crypto
      .createHash("md5")
      .update(`1${Date.now()}`)
      .digest("hex");
    this.matchId = crypto
      .createHash("md5")
      .update(`2${Date.now()}`)
      .digest("hex");
    this.sessionId = crypto
      .createHash("md5")
      .update(`3${Date.now()}`)
      .digest("hex");

    wss.on("connection", async (ws, req) => {
      console.log("Connected!");
      

      console.log('ip: ' + req.socket.remoteAddress);
      const clientIP = req.socket.remoteAddress;

      const bannedIPs = loadBannedIPs(); // Load banned IPs each time someone connects.

      // Check if the client's IP is banned.
      if (bannedIPs.includes(clientIP)) {
        console.log(`Blocked connection from banned IP: ${clientIP}`);
        ws.close(1000); // Close the WebSocket with a normal closure code.
        return;
      }

      // Check if the IP address has reached the connection threshold in the specified time window.
      const currentTime = Date.now();
      if (ipConnectionMap.has(clientIP)) {
        const connections = ipConnectionMap.get(clientIP).filter(time => currentTime - time < TIME_WINDOW);
        if (connections.length >= BAN_THRESHOLD) {
          console.log(`Banning IP: ${clientIP}`);
          // Implement your banning logic here.
          bannedIPs.push(clientIP);
          fs.writeFileSync(BAN_FILE, JSON.stringify(bannedIPs), 'utf8');
          return;
        }
      }

      // Store the current connection timestamp for the IP.
      if (!ipConnectionMap.has(clientIP)) {
        ipConnectionMap.set(clientIP, []);
      }
      ipConnectionMap.get(clientIP).push(currentTime);



      if (req.socket.remoteAddress.includes("3.80.229.247")) {
        BlockRiftEraKid(ws);
        ws.close(1000); // Use 1000 for a normal closure.
        return;
      }

      // 3 line patch for now
      if (!req.headers.authorization || !req.headers.authorization.includes("Epic-Signed") || !req.headers.authorization.includes("mms-player")) {
        BlockRiftEraKid(ws);
        ws.close(1000); // Use 1000 for a normal closure.
        return;
      }



      console.log("lol");
      console.log(req.headers);
      //const customKey = req.attributes["player.option.customKey"] || "none";
      //const season = req.attributes["player.season"];
      const region = req.bucketId;
      const playlist = req.cookies;

      playersids.push({ sessionId: "" });

      //console.log("Season: " + season);
      //console.log("Region: " + region);
      console.log("Cookies: " + playlist);
      ws.on("close", async (code) => {
        if (code === 1000) {
          //console.log(req);
          console.log('ip: ' + ws.remoteAddress);
          console.log('era kid trying again.')
          return;
        }

        players--;
        console.log("new player count: " + players);
        await GameServer.updateOne(
          { name: "NA" },
          { $set: { playerCount: players } }
        );
      });
      ws.on("message", (message) => {
        console.log("mm-message: " + message);
      });
      if (ws.protocol.toLowerCase() == "xmpp") return;
      // patch
      await Connecting(ws, this.ticketId, this.sessionId, this.matchId);
      Waiting(ws);
      Queued(ws, this.ticketId, this.sessionId, this.matchId);
      //await ILikeBigBootyHoles();
      //await WatchNA(ws, this.ticketId, this.sessionId, this.matchId);
      //await this.Connecting(ws, this.ticketId, this.sessionId, this.matchId);
      //this.Waiting(ws);
      //this.Queued(ws, this.ticketId, this.sessionId, this.matchId);

      //if (online == true) {
      //SessionAssignment(ws, this.matchId);
      //Join(ws, this.matchId, this.sessionId);
      //}
    });
  }
}

webapp.get("/", async (req, res) => {
  res.send("EON MMS is online!");
});

webapp.get(
  "/eon/gs/create/session/:region/:ip/:port/:playlist/:name",
  async (req, res) => {
    console.log("works!");
    let region = req.params.region;
    let ip = req.params.ip;
    let port = req.params.port;
    let playlist = req.params.playlist;
    let name = req.params.name;

    if (!region || !ip || !port || !playlist || !name)
      return res.json({ message: "invalid params" });

    const gameServer = await GameServer.findOne({ name: name });

    if (gameServer) {
      return res.json({ message: "Gameserver exists!" });
    }

    console.log("works1!");

    let gs = await GameServer.create({
      name: name,
      IP: ip,
      Port: port,
      status: "offline",
      playerCount: 0,
      playlist: playlist,
      region: region,
    });

    gs.save().catch((err) => {
      return res.json({ err: err });
    });
    console.log("works12!");

    return res.json({ message: "success!" });
  }
);
webapp.get("/eon/gs/status/set/:name/:status", async (req, res) => {
  let name = req.params.name;
  let status = req.params.status;
  const gameServer = await GameServer.findOne({ name: name });
  if (!gameServer) {
    return res.json({ message: "gameserver no existy." });
  }

  if (status == "online") {
    await GameServer.updateOne({ name: name }, { $set: { status: "online" } });
    return res.json({ message: "success" });
  } else if (status == "bus") {
    await GameServer.updateOne({ name: name }, { $set: { status: "bus" } });
    return res.json({ message: "success" });
  } else {
    await GameServer.updateOne({ name: name }, { $set: { status: "offline" } });
    return res.json({ message: "success" });
  }

  return res.json({ message: "some error occured." });
});

webapp.listen(80, () => {
  console.log("WebApp listening on port 80");
});

setInterval(async () => {
  let used = process.memoryUsage();
  let max = process.memoryUsage().heapTotal;
  let memoryUsagePercentage = ((used.heapUsed / max) * 100).toFixed(2);

  console.log(`Memory usage: ${memoryUsagePercentage}%`);
}, HEARTBEAT_INTERVAL);



setInterval(() => {
  const currentTime = Date.now();
  for (const [ip, connections] of ipConnectionMap.entries()) {
    ipConnectionMap.set(ip, connections.filter(time => currentTime - time < TIME_WINDOW));
  }
}, TIME_WINDOW);

// Matchmaker Service
new Matchmaker();

