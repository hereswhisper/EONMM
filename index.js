const crypto = require("crypto");
const WebSocket = require("ws").Server;
const express = require("express");
const { createServer } = require("http");
const GameServer = require("./schema");
const PlayerSch = require('./schemaplayers');
const mongoose = require("mongoose");
var application = express();
var webapp = express();
var fs = require('fs');
const BAN_FILE = 'ip.json';
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
let knownsessionIds = [];
let knownipsessions = [];

mongoose
  .connect(
    "",
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
      console.log("aa " + region + playlist + sessionId + matchId);
      // await WatchRegion(ws, ticketId, sessionId, matchId);
      //await WatchEU(ws, ticketId, sessionId, matchId);

      if (region == "NAE") {
        console.log('checking NAE');
        await WatchNA(ws, ticketId, sessionId, matchId);
      } else if (region == "EU") {
        console.log('checking eu');
        await WatchEU(ws, ticketId, sessionId, matchId);
      } else {
        console.log('wtf');
      }

      //console.log(`new players: ${players}`);
    } catch (error) {
      //console.error(`Error occurred while updating player count: ${error}`);
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

async function SessionAssignment(ws, matchId, ip, port) {

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



async function Join(ws, matchId, sessionId, ip, port, region) {
  //console.log('join!');

  let ipsessionid = "";

  knownipsessions.forEach(session => {
    console.log(session);
    if (session.ip == ip && session.region == region) {
      console.log('[EON-MMS]: Found region!');
      ipsessionid = session.sessionId;
    }
  });
  console.log('sessionid: ' + ipsessionid);
  let canMake = true;
  knownsessionIds.forEach(id => {
    if (id == sessionId) {
      canMake = false;
    }
  });

  uniqueid = "";

  playersids.forEach(player => {
    if (player.ws == ws) {
      uniqueid = player.uniqueId;
    }
  }); 

  if (canMake == true) {
    // playersids.push({ws: ws, uniqueId: uniqueId});
    let player = await PlayerSch.create({
      sessionId: ipsessionid,
      uniqueid: uniqueid,
      ticketId: "aaa",
      ip: ip,
      port: port
    });

    player.save().catch((err) => {
      console.log("error: " + err);
      //return res.json({ err: err });
    });
    knownsessionIds.push(ipsessionid);
  }

  function WsSend() {
    ws.send(
      JSON.stringify({
        payload: {
          matchId: matchId,
          sessionId: ipsessionid,
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
              SessionAssignment(ws, matchId, doc.IP, doc.Port);
            }, 1000);

            setTimeout(function () {
              // aaa

              let ipsessionid = "";

              knownipsessions.forEach(session => {
                if (session.ip == doc.IP && session.region == "NA") {
                  console.log('[EON-MMS]: Found region!');
                  sessionid = session.sessionId;
                }
              });
              Join(ws, matchId, ipsessionid, doc.IP, doc.Port, "NA");
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
  // wait
  console.log(sessionId);
  setInterval(async () => {
    GameServer.find({ region: "EU" })
      .then((documents) => {
        documents.forEach((doc) => {
          if (doc.status == "online") {
            setTimeout(function () {
              SessionAssignment(ws, matchId, doc.IP, doc.Port);
            }, 1000);

            setTimeout(function () {
              let ipsessionid = "";

              knownipsessions.forEach(session => {
                if (session.ip == doc.IP && session.region == "NA") {
                  console.log('[EON-MMS]: Found region!');
                  sessionid = session.sessionId;
                }
              });

              Join(ws, matchId, ipsessionid, doc.IP, doc.Port, "EU");
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

function RollSessionId() {
  let ticketId = crypto
    .createHash("md5")
    .update(`1${Date.now()}`)
    .digest("hex");
  let matchId = crypto
    .createHash("md5")
    .update(`2${Date.now()}`)
    .digest("hex");
  let sessionId = crypto
    .createHash("md5")
    .update(`3${Date.now()}`)
    .digest("hex");

  return { ticketId, matchId, sessionId };
}

function CreateSessionId() {
  let sessionId = crypto
    .createHash("md5")
    .update(`3${Date.now()}`)
    .digest("hex");

  return sessionId;
}

function RollSessionIdForIps() {
  knownipsessions = []; // clear it

  // NA
  GameServer.find({ region: "NA" })
    .then((documents) => {
      documents.forEach((doc) => {
        let IP = doc.IP;
        let Port = doc.Port;
        let uniqueSessionId = CreateSessionId();
        knownipsessions.push({ ip: IP, port: Port, sessionId: uniqueSessionId, region: "NA" });
      });
    })
    .catch((err) => {
      console.error(err);
    });

  // EU
  GameServer.find({ region: "EU" })
    .then((documents) => {
      documents.forEach((doc) => {
        let IP = doc.IP;
        let Port = doc.Port;
        let uniqueSessionId = CreateSessionId();
        knownipsessions.push({ ip: IP, port: Port, sessionId: uniqueSessionId, region: "EU" });
      });
    })
    .catch((err) => {
      console.error(err);
    });

  console.log('[EON-MMS]: Finished generating keys for all session ips!');
}

class Matchmaker {
  constructor() {
    // ids maybe need to be changed...

    let json = RollSessionId();
    RollSessionIdForIps(); // for ips

    let sessionId = json[0];
    let matchId = json[1];
    let ticketId = json[2];

    wss.on("connection", async (ws, req) => {
      //console.log("Connected!");

      //console.log('ip: ' + req.socket.remoteAddress);
      const clientIP = req.socket.remoteAddress;

      const bannedIPs = loadBannedIPs(); // Load banned IPs each time someone connects.

      // Check if the client's IP is banned.
      if (bannedIPs.includes(clientIP)) {
        //console.log(`Blocked connection from banned IP: ${clientIP}`);
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

      let uniqueId = crypto
        .createHash("md5")
        .update(`3${Date.now()}`)
        .digest("hex");

      console.log("lol");
      console.log(req.headers);
      //const customKey = req.attributes["player.option.customKey"] || "none";
      //const season = req.attributes["player.season"];
      const region = req.headers.authorization.split(" ")[3];
      const playlist = req.headers.authorization.split(" ")[4];

      playersids.push({ ws: ws, uniqueId: uniqueId });

      // authorization: 'Epic-Signed mms-player EONMMS= NAE playlist_defaultsquad 12582667 FE47BACD0B913530',




      // this will be used later
      //playersids.push({ sessionId: sessionId, uniqueId: uniqueId, ws: ws, ip: "aaa", port: 0 });

      //console.log("Season: " + season);
      //console.log("Region: " + region);
      console.log("Cookies: " + playlist);
      ws.on("close", async () => {
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
      await Connecting(ws, ticketId, sessionId, matchId, region, playlist);
      Waiting(ws);
      Queued(ws, ticketId, sessionId, matchId);
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

webapp.get('/eon/gs/match/search/:sessionid', async (req, res) => {
  let sessionid = req.params.sessionid;

  if (!sessionid) {
    return res.json({ "message": "this sessionId does not exist" });
  }

  const sessionlookup = await PlayerSch.findOne({ sessionId: sessionid });

  if (!sessionlookup) {
    return res.json({ message: "there is no sessionid on this list named that." });
  }

  return res.send(sessionid + " " + sessionlookup.ip + ":" + sessionlookup.port);
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




// Matchmaker Service
new Matchmaker();

