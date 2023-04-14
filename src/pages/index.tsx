import { useState, useRef, useCallback, useEffect } from "react";

const IndexPage = () => {
  const [roomId, setRoomId] = useState("");
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const newSocketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection>();
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);

  // イベントリスナーを追加
  const addEventListeners = useCallback(() => {
    const { current: PConnection } = peerConnectionRef;
    if (!PConnection) return;

    PConnection.addEventListener("track", (event) => {
      console.log("Remote stream:", event.streams[0]);
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    });

    PConnection.addEventListener("icecandidate", (event) => {
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
    PConnection.addEventListener("icegatheringstatechange", () => {
      console.log(
        "ICE gathering state changed:",
        PConnection.iceGatheringState
      );
    });
    PConnection.addEventListener("iceconnectionstatechange", () => {
      console.log(
        "ICE connection state changed:",
        PConnection.iceConnectionState
      );
    });
    PConnection.addEventListener("connectionstatechange", () => {
      console.log(
        "Peer connection state changed:",
        PConnection.connectionState
      );
    });
    PConnection.addEventListener("iceconnectionstatechange", async () => {
      if (
        PConnection.iceConnectionState === "connected" ||
        PConnection.iceConnectionState === "completed"
      ) {
        // Add any pending ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          await PConnection.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current.length = 0;
      }
    });
    console.log(
      "ICE gathering state:",
      peerConnectionRef.current?.iceGatheringState
    );
    console.log("ICE connection state:", PConnection.iceConnectionState);
    console.log("Peer connection state:", PConnection.connectionState);
    PConnection.addEventListener("icegatheringstatechange", () => {
      console.log(
        "ICE gathering state changed:",
        PConnection.iceGatheringState
      );
    });
  }, [roomId]);

  // ここでWebSocketとPeerConnectionを作成
  const createWebSocketAndPeerConnection = useCallback(async () => {
    if (!roomId) return;
    const newSocket = new WebSocket(
      process.env.NODE_ENV === "production"
        ? `ws://160.251.141.164:5500/socket.io/?roomId=${roomId}`
        : `ws://localhost:5500/socket.io/?roomId=${roomId}`
    );
    newSocketRef.current = newSocket;
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
      ],
    });
    peerConnectionRef.current = peerConnection;

    // ここでローカルストリームを取得
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    // ここでローカルストリームを再生
    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });

    newSocket.onopen = () => {
      console.log("WebSocket opened");
    };

    // ここでWebSocketが閉じた時の処理を設定
    newSocket.onclose = (event) => {
      console.log("WebSocket closed:", event.code, event.reason);
    };

    // ここでWebSocketのMsgが来た時の処理を設定
    newSocket.onmessage = async (event) => {
      if (!event?.data) {
        return;
      }
      const data = JSON.parse(event.data);
      // offerが来た時の処理
      if (data.type === "offer") {
        const sdpData = data.sdp;
        console.log("Receive offer:", sdpData);

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: sdpData })
        );
        // 新しいトラックを追加
        const audioTransceiver = peerConnection.addTransceiver("audio", {
          direction: "sendrecv",
        });
        audioTransceiver.sender.replaceTrack(localStream.getTracks()[0]);
        // ここでanswerを作成
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription({
          type: "answer",
          sdp: answer.sdp,
        });
        // ここでanswerを送信
        newSocket.send(
          JSON.stringify({
            type: "answer",
            answer,
            sdp: answer.sdp,
            roomId,
          })
        );

        // ここでICE candidateが来るまで待つ
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnection.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current.length = 0;
        // ここでICE candidateが来た時の処理
      } else if (data.type === "candidate") {
        console.log("Receiving ICE candidate:", data.candidate);
        const candidate = new RTCIceCandidate(data.candidate);
        // リモートのSDPがセットされている場合はICE candidateを追加
        if (
          peerConnection.remoteDescription &&
          peerConnection.remoteDescription.type
        ) {
          await peerConnection.addIceCandidate(candidate);
          console.log("Added ICE candidate:", candidate);
          // リモートのSDPがセットされていない場合はICE candidateを保留
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
        // answerが来た時の処理
      } else if (data.type === "answer") {
        console.log("Receive answer:", data.answer);
        // ここで、RTCPeerConnectionの状態をチェック
        if (peerConnection.signalingState === "have-local-offer") {
          // リモートのAnswerを設定
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp: data.answer.sdp })
          );
        } else {
          console.log("Signaling state is not 'have-local-offer'");
        }
      }
    };

    // ここでICE connectionの状態が変わった時の処理を設定
    peerConnection.oniceconnectionstatechange = () => {
      console.log(
        "ICE connection state changed:",
        peerConnection.iceConnectionState
      );
      if (
        peerConnection.iceConnectionState === "connected" ||
        peerConnection.iceConnectionState === "completed"
      ) {
        console.log("ICE connection Established!");
      }
    };
    // ここでICE candidateが作成された時の処理を設定
    peerConnection.onicecandidate = (event) => {
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
  // Offerを作成してルームに参加する
  const createOfferAndJoinRoom = useCallback(async () => {
    await createWebSocketAndPeerConnection();
    addEventListeners();
    const { current: PConnection } = peerConnectionRef;
    if (!PConnection) return;

    const offer = await PConnection.createOffer();
    if (offer) {
      await PConnection.setLocalDescription({
        type: "offer",
        sdp: offer.sdp,
      });

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
          sdp: offer.sdp,
        })
      );
    }
  }, [addEventListeners, createWebSocketAndPeerConnection, roomId]);

  // ルームに参加する
  const joinRoom = useCallback(async () => {
    if (!roomId) return;
    console.log("Joining room:", roomId);
    await createOfferAndJoinRoom();
  }, [createOfferAndJoinRoom, roomId]);

  // ルームから退出する
  const leaveRoom = () => {
    if (newSocketRef.current) {
      newSocketRef.current.close();
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (pendingCandidatesRef.current) {
      pendingCandidatesRef.current.length = 0;
    }
  };

  // コンポーネントがアンマウントされた時に呼ばれる
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

  // リモートのストリームを取得する*重要*
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
        <button
          onClick={async () => {
            joinRoom();
          }}
          className="bg-lime-300"
        >
          Join Room
        </button>
        <button
          onClick={() => {
            leaveRoom();
          }}
          className="bg-red-400"
        >
          Leave Room
        </button>
      </div>
      <div>
        <audio ref={localAudioRef} autoPlay playsInline controls muted />
        <audio ref={remoteAudioRef} autoPlay playsInline />
      </div>
    </div>
  );
};

export default IndexPage;
