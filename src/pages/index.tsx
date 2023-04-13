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
      process.env.NODE_ENV === "production"
        ? `ws://160.251.141.164:5500/socket.io/?roomId=${roomId}`
        : `ws://localhost:5500/socket.io/?roomId=${roomId}`
    );
    newSocketRef.current = newSocket;

    peerConnectionRef.current = peerConnection;

    newSocket.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
    };
    const pendingCandidates: RTCIceCandidate[] = [];
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    newSocket.onmessage = async (event) => {
      if (!event?.data) {
        return;
      }
      const data = JSON.parse(event.data);
      // console.log("こんなデータを受け取ったよ！", data);
      if (data.type === "offer") {
        // ここでSDPデータを取得
        const sdpData = data.sdp;
        console.log("受け取ったoffer:", sdpData);
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: sdpData })
        );
        // 新しいトラックを追加
        const audioTransceiver = peerConnection.addTransceiver("audio", {
          direction: "sendrecv",
        });
        audioTransceiver.sender.replaceTrack(localStream.getTracks()[0]);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription({
          type: "answer",
          sdp: answer.sdp,
        });

        newSocket.send(
          JSON.stringify({
            type: "answer",
            answer,
            sdp: answer.sdp,
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
          console.log("Added ICE candidate:", candidate);
        } else {
          pendingCandidates.push(candidate);
        }
      } else if (data.type === "answer") {
        console.log("受け取ったanswer:", data.answer);
        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "answer", sdp: data.answer.sdp })
        );
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
        console.log("ICE connection 成功！！！！！！！！！！！！！");
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

    peerConnection.addEventListener("icecandidate", (event) => {
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

    peerConnection.addEventListener("icegatheringstatechange", () => {
      console.log(
        "ICE gathering state changed:",
        peerConnection.iceGatheringState
      );
    });

    peerConnection.addEventListener("iceconnectionstatechange", () => {
      console.log(
        "ICE connection state changed:",
        peerConnection.iceConnectionState
      );
    });

    peerConnection.addEventListener("connectionstatechange", () => {
      console.log(
        "Peer connection state changed:",
        peerConnection.connectionState
      );
    });
    peerConnection.addEventListener("iceconnectionstatechange", async () => {
      if (
        peerConnection.iceConnectionState === "connected" ||
        peerConnection.iceConnectionState === "completed"
      ) {
        // Add any pending ICE candidates
        for (const candidate of pendingCandidates) {
          await peerConnection.addIceCandidate(candidate);
        }
        pendingCandidates.length = 0;
      }
    });
    peerConnection.addEventListener("track", (event) => {
      console.log("Remote stream:", event.streams[0]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    });
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

      console.log("Joining room:", roomId);

      if (newSocketRef.current) {
        console.log("newSocketRef.current", newSocketRef.current);

        newSocketRef.current.addEventListener("open", async () => {
          console.log("WebSocket opened");

          const offer = await peerConnectionRef.current?.createOffer();
          console.log("ここのofferはこれ！！！:", offer);

          if (offer) {
            await peerConnectionRef.current?.setLocalDescription({
              type: "offer",
              sdp: offer.sdp,
            });

            newSocketRef.current?.send(
              JSON.stringify({
                type: "join",
                roomId,
              })
            );
            console.log("offer.sdp:", offer.sdp);

            newSocketRef.current?.send(
              JSON.stringify({
                type: "offer",
                roomId,
                sdp: offer.sdp,
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

  useEffect(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = (event) => {
        console.log("Remote stream:", event.streams[0]);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };
    }
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
        <audio ref={localAudioRef} autoPlay playsInline controls muted />
        <audio ref={remoteAudioRef} autoPlay playsInline controls />
      </div>
      <div>{errorMessage}</div>
    </div>
  );
};

export default IndexPage;
