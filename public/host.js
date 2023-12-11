export async function handleHosting(ws, localStream) {
  let viewers = new Map();

  function handleICECandidateEvent(event, target) {
    if (event.candidate) {
      const payload = {
        type: "new-ice-candidate",
        data: {
          target: target,
          candidate: event.candidate,
        },
      };
      ws.send(JSON.stringify(payload));
    }
  }

  async function handleNegotiationStart(targetId) {
    console.log("im called");
    const peerConn = new RTCPeerConnection({
      iceServers: [
        {
          urls: "stun:stun.l.google.com:19302",
        },
        {
          urls: "stun:stun1.l.google.com:19302",
        },
      ],
    });

    peerConn.onicecandidate = (event) =>
        handleICECandidateEvent(event, targetId);
    peerConn.onnegotiationneeded = () => handleNegotiationNeededEvent(targetId);
    viewers.set(targetId, {
      peerConn,
    });

    const tracks = localStream.getTracks();
    tracks.forEach((track) => peerConn.addTrack(track, localStream));
  }

  async function handleNegotiationNeededEvent(target) {

    const conn = viewers.get(target).peerConn;
    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    const payload = {
      type: "video-offer",
      data: {
        target,
        sdp: conn.localDescription,
      },
    };
    ws.send(JSON.stringify(payload));

  }

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    console.log(data);

    switch (data.type) {
      case "new-viewer": {
        const viewerId = data.data.target;
        handleNegotiationStart(viewerId);
        break;
      }
      case "video-answer": {
        const {sdp, owner} = data.data;
        const desc = new RTCSessionDescription(sdp);
        viewers.get(owner).peerConn.setRemoteDescription(desc);
        break;
      }
      case "new-ice-candidate": {
        const {candidate, owner} = data.data;
        viewers.get(owner).peerConn.addIceCandidate(candidate);
      }
    }
  };
}
