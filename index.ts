import type { WebSocket } from "ws";
import { WebSocketServer } from "ws";
import { z } from "zod";
import * as crypto from "crypto";
import express from "express";

const MessageSchema = z.object({
  type: z.enum([
    "stream-start",
    "video-offer",
    "video-answer",
    "new-ice-candidate",
    "join-stream",
  ]),
  data: z.unknown().nullable(),
});

const OfferSchema = z.object({
  target: z.string(),
  sdp: z.any(),
});

const IceCandidateSchema = z.object({
  candidate: z.any(),
  target: z.string(),
});

const StreamJoinSchema = z.object({
  streamId: z.string(),
});

const wss = new WebSocketServer({ port: 8080 });

const ConnectionsMap = new Map<string, Connection>();

type Connection = {
  socket: WebSocket;
  viewers: string[] | null;
};

const askForStream = (streamId: string, callee: string) => {
  const owner = ConnectionsMap.get(streamId)!.socket;
  const payload = {
    type: "new-viewer",
    data: {
      target: callee,
    },
  };
  owner.send(JSON.stringify(payload));
};

const getHosts = () => {
  const connections = Array.from(ConnectionsMap);
  return connections
    .filter(([_, { viewers }]) => viewers !== null)
    .map(([id]) => id);
};

const updateSocketsOnConnections = (socket: WebSocket) => (hosts: string[]) =>
  socket.send(
    JSON.stringify({
      type: "update_hosts",
      data: {
        hosts,
      },
    }),
  );

const sendUpdateMessage = () => {
  const connections = Array.from(ConnectionsMap);
  const hosts = getHosts();

  connections.forEach(([_, { socket }]) => {
    updateSocketsOnConnections(socket)(hosts);
  });
};

const app = express();
const port = 3000;

app.use(express.static("public"));

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

wss.on("connection", function connection(ws) {
  const id = crypto.randomUUID();
  ConnectionsMap.set(id, {
    socket: ws,
    viewers: null,
  });

  const hosts = getHosts();
  updateSocketsOnConnections(ws)(hosts);

  ws.onclose = () => {
    ConnectionsMap.delete(id);
    sendUpdateMessage();
  };

  ws.on("message", function message(data) {
    const result = MessageSchema.parse(JSON.parse(data.toString()));

    switch (result.type) {
      case "stream-start": {
        ConnectionsMap.set(id, {
          socket: ws,
          viewers: [],
        });
        sendUpdateMessage();
        break;
      }
      case "join-stream": {
        const { streamId } = StreamJoinSchema.parse(result.data);
        ConnectionsMap.set(streamId, {
          socket: ConnectionsMap.get(streamId)!.socket,
          viewers: [...ConnectionsMap.get(streamId)!.viewers!, id],
        });
        sendUpdateMessage();
        askForStream(streamId, id);
        break;
      }
      case "video-offer": {
        const offer = OfferSchema.parse(result.data);
        const targetSocket = ConnectionsMap.get(offer.target)!.socket;
        const payload = {
          type: "video-offer",
          data: {
            owner: id,
            sdp: offer.sdp,
          },
        };
        targetSocket.send(JSON.stringify(payload));
        break;
      }
      case "video-answer": {
        const offer = OfferSchema.parse(result.data);
        const targetSocket = ConnectionsMap.get(offer.target)!.socket;
        const payload = {
          type: "video-answer",
          data: {
            owner: id,
            sdp: offer.sdp,
          },
        };
        targetSocket.send(JSON.stringify(payload));
        break;
      }
      case "new-ice-candidate":
        const { target, candidate } = IceCandidateSchema.parse(result.data);
        const targetSocket = ConnectionsMap.get(target)!.socket;
        const payload = {
          type: "new-ice-candidate",
          data: {
            owner: id,
            candidate,
          },
        };
        targetSocket.send(JSON.stringify(payload));
    }
  });
});
