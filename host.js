export async function handleHosting(ws, localStream) {
  let target;

  const myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.stunprotocol.org",
      },
    ],
  });

  myPeerConnection.onicecandidate = handleICECandidateEvent;
  myPeerConnection.onnegotiationneeded = handleNegotiationNeededEvent;

  function handleICECandidateEvent(event) {
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
    target = targetId;

    const tracks = localStream.getTracks();
    tracks.forEach((track) => myPeerConnection.addTrack(track, localStream));
  }

  async function handleNegotiationNeededEvent() {
    const offer = await myPeerConnection.createOffer();
    await myPeerConnection.setLocalDescription(offer);
    const payload = {
      type: "video-offer",
      data: {
        target,
        sdp: myPeerConnection.localDescription,
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
        const { sdp } = data.data;
        const desc = new RTCSessionDescription(sdp);
        myPeerConnection.setRemoteDescription(desc);
        break;
      }
      case "new-ice-candidate": {
        const { candidate } = data.data;
        myPeerConnection.addIceCandidate(candidate);
      }
    }
  };
}
