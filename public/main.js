import { handleHosting } from "./host.js";
import { handleClient } from "./client.js";

const ws = new WebSocket("ws://localhost:8080");

ws.addEventListener("message", (msg) => {
  const data = JSON.parse(msg.data);
  if (data.type === "update_hosts") {
    const root = document.getElementById("hosts");
    if (!root) return;

    const nodes = data.data.hosts.map((hostname) => {
      const li = document.createElement("button");
      li.textContent = hostname;
      li.onclick = () => onStreamJoin(hostname);
      return li;
    });
    root.replaceChildren(...nodes);
  }
});

async function onStreamJoin(streamId) {
  document.body.innerHTML = `<video></video>`;
  await handleClient(ws);

  const payload = {
    type: "join-stream",
    data: {
      streamId,
    },
  };
  ws.send(JSON.stringify(payload));
}

async function onHostStart() {
  document.body.innerHTML = `
        <video></video>`;
  const video = document.querySelector("video");
  document.body.appendChild(video);
  const mediaConstraints = {
    audio: true, // We want an audio track
    video: true, // And we want a video track
  };
  const localStream =
    await navigator.mediaDevices.getDisplayMedia(mediaConstraints);
  video.srcObject = localStream;

  console.log(localStream);
  await handleHosting(ws, localStream.clone());
  ws.send(JSON.stringify({ type: "stream-start" }));
}

document.getElementById("btn").onclick = onHostStart;
