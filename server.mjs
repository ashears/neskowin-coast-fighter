import crypto from "node:crypto";
import http from "node:http";
import os from "node:os";

const PORT = Number(process.env.PORT ?? 8080);
const rooms = new Map();

const server = http.createServer((_request, response) => {
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("Neskowin Coast Fighter online relay is running.\n");
});

server.on("upgrade", (request, socket) => {
  const key = request.headers["sec-websocket-key"];
  if (typeof key !== "string") {
    socket.destroy();
    return;
  }

  const accept = crypto.createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "",
      "",
    ].join("\r\n"),
  );

  const client = { socket, roomCode: "", role: "" };
  socket.on("data", (buffer) => readFrames(buffer).forEach((payload) => handleMessage(client, payload)));
  socket.on("close", () => leaveRoom(client));
  socket.on("error", () => leaveRoom(client));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Online relay listening on port ${PORT}`);
  for (const address of getLocalAddresses()) {
    console.log(`ws://${address}:${PORT}`);
  }
});

function handleMessage(client, payload) {
  let message;
  try {
    message = JSON.parse(payload);
  } catch {
    return;
  }

  if (message.type === "create") {
    const roomCode = createRoomCode();
    rooms.set(roomCode, { host: client, guest: undefined });
    client.roomCode = roomCode;
    client.role = "host";
    send(client, { type: "created", roomCode });
    return;
  }

  if (message.type === "join") {
    const roomCode = String(message.roomCode ?? "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room || room.guest) {
      send(client, { type: "error", message: "Room not found or already full" });
      return;
    }
    room.guest = client;
    client.roomCode = roomCode;
    client.role = "guest";
    send(client, { type: "joined", roomCode });
    send(room.host, { type: "peer-joined" });
    return;
  }

  const room = rooms.get(client.roomCode);
  if (!room) return;
  const peer = client.role === "host" ? room.guest : room.host;
  if (peer) send(peer, message);
}

function leaveRoom(client) {
  if (!client.roomCode) return;
  const room = rooms.get(client.roomCode);
  if (!room) return;
  const peer = client.role === "host" ? room.guest : room.host;
  if (peer) send(peer, { type: "peer-left" });
  rooms.delete(client.roomCode);
  client.roomCode = "";
}

function send(client, message) {
  if (!client || client.socket.destroyed) return;
  client.socket.write(writeFrame(JSON.stringify(message)));
}

function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  do {
    code = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function readFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset++];
    const second = buffer[offset++];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    if (length === 126) {
      if (offset + 2 > buffer.length) break;
      length = buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (offset + 8 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(offset));
      offset += 8;
    }
    if (!masked || offset + 4 + length > buffer.length) break;
    const mask = buffer.subarray(offset, offset + 4);
    offset += 4;
    const payload = buffer.subarray(offset, offset + length);
    offset += length;
    if (opcode === 8) break;
    if (opcode !== 1) continue;
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= mask[index % 4];
    }
    messages.push(payload.toString("utf8"));
  }
  return messages;
}

function writeFrame(message) {
  const payload = Buffer.from(message);
  if (payload.length < 126) {
    return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
  }
  const header = Buffer.alloc(4);
  header[0] = 0x81;
  header[1] = 126;
  header.writeUInt16BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

function getLocalAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
}
