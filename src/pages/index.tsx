import { useState, useRef } from "react";

const IndexPage = () => {
  const [roomId, setRoomId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const joinRoom = async () => {
    if (!roomId) return;

    console.log("Joining room:", roomId);

    const newSocket = new WebSocket(
      `ws://localhost:5500/socket.io/?roomId=${roomId}`
    );

    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnection.ontrack = (event) => {
      console.log("Track received:", event);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE candidate:", event.candidate);
        newSocket.send(
          JSON.stringify({
            type: "signal",
            roomId,
            candidate: event.candidate,
          })
        );
      }
    };

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    newSocket.onmessage = async (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "signal") {
        const signalData = message.data;

        if (signalData.type === "offer") {
          console.log("Received offer:", signalData);
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(signalData.sdp)
          );

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          console.log("Sending answer:", answer);
          newSocket.send(
            JSON.stringify({
              type: "signal",
              roomId,
              sdp: answer,
            })
          );
        } else if (signalData.type === "answer") {
          console.log("Received answer:", signalData);
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(signalData.sdp)
          );
        } else if (signalData.type === "candidate") {
          console.log("Received ICE candidate:", signalData.candidate);
          await peerConnection.addIceCandidate(
            new RTCIceCandidate(signalData.candidate)
          );
        }
      }
    };

    newSocket.onopen = () => {
      console.log("WebSocket connected");
      newSocket.send(JSON.stringify({ type: "join", roomId: roomId }));
    };

    newSocket.onclose = () => {
      console.log("WebSocket disconnected");
    };

    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    console.log("Sending offer:", offer);
    newSocket.send(
      JSON.stringify({
        type: "signal",
        roomId,
        sdp: offer,
      })
    );
  };

  return (
    <div className="absolute top-0 left-0 h-full w-full container bg-blue-200">
      <h1>Audio Chat</h1>
      <input
        type="text"
        className="text-black"
        placeholder="Enter Room ID"
        value={roomId}
        onChange={(e) => setRoomId(e.target.value)}
      />
      <button onClick={joinRoom}>Join Room</button>
      {errorMessage && <p>{errorMessage}</p>}
      <div>
        <h2>Local audio:</h2>
        <audio ref={localAudioRef} autoPlay muted />
      </div>
      <div>
        <h2>Remote audio:</h2>
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
};

export default IndexPage;
