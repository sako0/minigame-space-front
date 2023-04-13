import { useState, useRef, useCallback, useEffect } from "react";

const IndexPage = () => {
  const [roomId, setRoomId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const newSocketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection>();

  const createWebSocketAndPeerConnection = useCallback(async () => {
    if (!roomId) return;

    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ],
    });

    const newSocket = new WebSocket(
      `ws://localhost:5500/socket.io/?roomId=${roomId}`
    );
    newSocketRef.current = newSocket;

    peerConnectionRef.current = peerConnection;
    peerConnection.ontrack = (event) => {
      console.log("Remote stream:", event.streams[0]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    };

    newSocket.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
    };
    const pendingCandidates: RTCIceCandidate[] = [];

    newSocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      console.log("Message received:", data);
      if (data.type === "offer") {
        // ここでSDPデータを取得
        const sdpData = data.sdp;
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({
            type: sdpData.type,
            sdp: sdpData.sdp,
          })
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        newSocket.send(
          JSON.stringify({
            type: "answer",
            answer,
            sdp: answer,
            roomId,
          })
        );

        // Add any pending ICE candidates
        for (const candidate of pendingCandidates) {
          await peerConnection.addIceCandidate(candidate);
        }
        pendingCandidates.length = 0;
      } else if (data.type === "candidate") {
        console.log("Receiving ICE candidate:", data.candidate);
        const candidate = new RTCIceCandidate(data.candidate);

        if (
          peerConnection.remoteDescription &&
          peerConnection.remoteDescription.type
        ) {
          await peerConnection.addIceCandidate(candidate);
        } else {
          pendingCandidates.push(candidate);
        }
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state changed:",
        peerConnection.iceConnectionState
      );
      if (
        peerConnection.iceConnectionState === "connected" ||
        peerConnection.iceConnectionState === "completed"
      ) {
        console.log("ICE connection established");
      }
    };
    peerConnection.onicecandidate = (event) => {
      console.log("Sending ICE candidate:", event.candidate);
      if (event.candidate) {
        console.log("Sending ICE candidate:", event.candidate);
        newSocket.send(
          JSON.stringify({
            type: "candidate",
            roomId,
            candidate: event.candidate,
          })
        );
      }
    };
  }, [roomId]);

  // ルームに参加する
  const joinRoom = useCallback(async () => {
    if (!roomId) return;

    // if (
    //   typeof navigator === "undefined" ||
    //   !navigator.mediaDevices ||
    //   !navigator.mediaDevices.getUserMedia
    // ) {
    //   setErrorMessage(
    //     "Error getting user media: Your browser does not support WebRTC."
    //   );
    //   return;
    // }

    try {
      await createWebSocketAndPeerConnection();
      peerConnectionRef.current?.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate:", event.candidate);
          newSocketRef.current?.send(
            JSON.stringify({
              type: "candidate",
              roomId,
              candidate: event.candidate,
            })
          );
        }
      });

      peerConnectionRef.current?.addEventListener(
        "icegatheringstatechange",
        () => {
          console.log(
            "ICE gathering state changed:",
            peerConnectionRef.current?.iceGatheringState
          );
        }
      );

      peerConnectionRef.current?.addEventListener(
        "iceconnectionstatechange",
        () => {
          console.log(
            "ICE connection state changed:",
            peerConnectionRef.current?.iceConnectionState
          );
        }
      );

      peerConnectionRef.current?.addEventListener(
        "connectionstatechange",
        () => {
          console.log(
            "Peer connection state changed:",
            peerConnectionRef.current?.connectionState
          );
        }
      );
      console.log(
        "ICE gathering state:",
        peerConnectionRef.current?.iceGatheringState
      );
      console.log(
        "ICE connection state:",
        peerConnectionRef.current?.iceConnectionState
      );
      console.log(
        "Peer connection state:",
        peerConnectionRef.current?.connectionState
      );
      peerConnectionRef.current?.addEventListener(
        "icegatheringstatechange",
        () => {
          console.log(
            "ICE gathering state changed:",
            peerConnectionRef.current?.iceGatheringState
          );
        }
      );

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      console.log("getUserMedia successful");

      if (localAudioRef.current) {
        localAudioRef.current.srcObject = localStream;
      }
      localStream.getTracks().forEach((track) => {
        peerConnectionRef.current?.addTrack(track, localStream);
      });

      console.log("Joining room:", roomId);

      if (newSocketRef.current) {
        console.log("newSocketRef.current", newSocketRef.current);

        newSocketRef.current.addEventListener("open", async () => {
          console.log("WebSocket opened");

          const offer = await peerConnectionRef.current?.createOffer();
          console.log("offer", offer);

          if (offer) {
            await peerConnectionRef.current?.setLocalDescription(offer);

            newSocketRef.current?.send(
              JSON.stringify({
                type: "join",
                roomId,
              })
            );
            newSocketRef.current?.send(
              JSON.stringify({
                type: "offer",
                roomId,
                sdp: offer,
              })
            );
          }
        });
      }
    } catch (error) {
      console.error("getUserMedia error:", error);
    }
  }, [roomId, createWebSocketAndPeerConnection, peerConnectionRef]);

  const leaveRoom = () => {
    if (newSocketRef.current) {
      newSocketRef.current.close();
    }
  };

  useEffect(() => {
    return () => {
      if (newSocketRef.current) {
        newSocketRef.current.close();
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  return (
    <div className="absolute top-0 left-0 h-full w-full bg-orange-200">
      <h1>WebRTC Demo</h1>
      <div>
        <input
          type="text"
          value={roomId}
          className="text-black"
          onChange={(event) => setRoomId(event.target.value)}
        />
        <button onClick={() => joinRoom()} className="bg-lime-300">
          Join Room
        </button>
        <button onClick={leaveRoom} className="bg-red-400">
          Leave Room
        </button>
      </div>
      <div>
        <audio ref={localAudioRef} autoPlay playsInline muted />
        <audio ref={remoteAudioRef} autoPlay />
      </div>
      <div>{errorMessage}</div>
    </div>
  );
};

export default IndexPage;
