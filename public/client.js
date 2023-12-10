export async function handleClient(ws) {
  let target;

  const myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.stunprotocol.org",
      },
    ],
  });

  myPeerConnection.onicecandidate = handleICECandidateEvent;
  myPeerConnection.ontrack = handleTrackEvent;

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    console.log(data);

    switch (data.type) {
      case "video-offer": {
        const { owner, sdp } = data.data;
        target = owner;

        const desc = new RTCSessionDescription(sdp);
        myPeerConnection.setRemoteDescription(desc).then(() => {
          myPeerConnection.createAnswer().then((answer) => {
            myPeerConnection.setLocalDescription(answer).then(() => {
              const payload = {
                type: "video-answer",
                data: {
                  target: owner,
                  sdp: myPeerConnection.localDescription,
                },
              };
              ws.send(JSON.stringify(payload));
            });
          });
        });
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

  function handleTrackEvent(event) {
    console.log(event);
    document.querySelector("video").srcObject = event.streams[0];
  }

  function handleICECandidateEvent(event) {
    if (event.candidate) {
      const payload = {
        type: "new-ice-candidate",
        data: {
          target,
          candidate: event.candidate,
        },
      };
      ws.send(JSON.stringify(payload));
    }
  }
}
