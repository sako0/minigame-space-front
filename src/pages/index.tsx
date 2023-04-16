import { useState, useRef, useCallback, useEffect } from "react";

const IndexPage = () => {
  const [roomId, setRoomId] = useState("");
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const newSocketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection>();
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);

  // 再生する
  const handleAudioPlayback = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.play();
    }
  };
  // イベントリスナーを追加する
  const addEventListeners = useCallback(() => {
    const { current: PConnection } = peerConnectionRef;
    if (!PConnection) return;

    PConnection.addEventListener("track", (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
      }
    });

    PConnection.addEventListener("icecandidate", (event) => {
      if (event.candidate) {
        newSocketRef.current?.send(
          JSON.stringify({
            type: "candidate",
            roomId,
            candidate: event.candidate,
          })
        );
      }
    });

    PConnection.addEventListener("iceconnectionstatechange", async () => {
      if (
        PConnection.iceConnectionState === "connected" ||
        PConnection.iceConnectionState === "completed"
      ) {
        for (const candidate of pendingCandidatesRef.current) {
          await PConnection.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current.length = 0;
      }
    });
  }, [roomId]);

  // WebSocketとPeerConnectionを作成する
  const createWebSocketAndPeerConnection = useCallback(async () => {
    if (!roomId) return;
    const newSocket = new WebSocket(
      process.env.NODE_ENV === "production"
        ? `wss://api.mini-game-space.link/socket.io/?roomId=${roomId}`
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
      if (data.type === "offer") {
        const sdpData = data.sdp;

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: "offer", sdp: sdpData })
        );
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
        // ここでICE candidateが来るまで待つ
        for (const candidate of pendingCandidatesRef.current) {
          await peerConnection.addIceCandidate(candidate);
        }
        pendingCandidatesRef.current.length = 0;
      } else if (data.type === "answer") {
        const sdpData = data.sdp;
        if (peerConnection.signalingState === "have-local-offer") {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({
              type: "answer",
              sdp: sdpData,
            })
          );
        }
      } else if (data.type === "candidate") {
        const candidate = new RTCIceCandidate(data.candidate);
        if (
          peerConnection.iceConnectionState === "connected" ||
          peerConnection.iceConnectionState === "completed"
        ) {
          await peerConnection.addIceCandidate(candidate);
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      }
    };
    addEventListeners();
  }, [roomId, addEventListeners]);

  // コールをかける
  const offerCall = useCallback(async () => {
    const { current: PConnection } = peerConnectionRef;
    if (!PConnection) return;
    const offer = await PConnection.createOffer();
    await PConnection.setLocalDescription(offer);
    newSocketRef.current?.send(
      JSON.stringify({ type: "offer", roomId, sdp: offer.sdp })
    );
  }, [roomId]);
  // 入室する
  const joinRoom = useCallback(async () => {
    if (!roomId) return;
    await createWebSocketAndPeerConnection();
    if (localAudioRef.current) {
      localAudioRef.current.srcObject =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
    }
    offerCall();
  }, [roomId, createWebSocketAndPeerConnection, offerCall]);

  // 退室する
  const leaveRoom = useCallback(() => {
    if (newSocketRef.current) {
      newSocketRef.current.close();
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  }, []);

  // コンポーネントがアンマウントされた時LeaveRoomを実行する
  useEffect(() => {
    return () => {
      leaveRoom();
    };
  }, [leaveRoom]);

  // リモートのストリームを取得する*重要*
  useEffect(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };
    }
  }, []);

  return (
    <div className="text-center">
      <div>
        <input
          className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black"
          placeholder="1"
          type="text"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button
          className="bg-lime-500 rounded-md shadow-lg m-2 p-2"
          onClick={async () => {
            await joinRoom();
            handleAudioPlayback();
          }}
        >
          Join Room
        </button>
        <button
          className="bg-red-500 rounded-md shadow-lg m-2 p-2"
          onClick={() => {
            leaveRoom();
          }}
        >
          Leave Room
        </button>
      </div>
      {/* <audio ref={localAudioRef} autoPlay muted /> */}
      <div className="flex justify-center mt-10">
        <audio ref={remoteAudioRef} autoPlay playsInline controls />
      </div>
    </div>
  );
};

export default IndexPage;
