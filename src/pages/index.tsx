import React from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

const IndexPage = () => {
  const [roomId, setRoomId] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [clientId, setClientId] = useState(uuidv4());
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const newSocketRef = useRef<WebSocket | null>(null);
  const [remoteAudioRefsState, setRemoteAudioRefsState] = useState<
    Map<string, React.RefObject<HTMLAudioElement>>
  >(new Map());
  const [remoteAudioStreams, setRemoteAudioStreams] = useState<
    Map<string, MediaStream>
  >(new Map());
  const peerConnectionRefs = useRef<Map<string, RTCPeerConnection>>(new Map()); // 複数のPeerConnectionを管理するためのMap
  const pendingCandidatesRefs = useRef<Map<string, RTCIceCandidate[]>>(
    new Map()
  );

  // イベントリスナーを追加する
  const addEventListeners = useCallback(
    (PConnection: RTCPeerConnection) => {
      if (!PConnection) return;
      PConnection.addEventListener("track", (event) => {
        const streamId = event.streams[0].id;
        const newAudioRef = React.createRef<HTMLAudioElement>();

        // Update remoteAudioRefs
        setRemoteAudioRefsState((prevRemoteAudioRefs) => {
          const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
          newRemoteAudioRefs.set(streamId, newAudioRef);
          return newRemoteAudioRefs;
        });

        // Update remoteAudioStreams
        setRemoteAudioStreams((prevRemoteAudioStreams) => {
          const newRemoteAudioStreams = new Map(prevRemoteAudioStreams);
          newRemoteAudioStreams.set(streamId, event.streams[0]);
          return newRemoteAudioStreams;
        });
      });

      PConnection.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
          newSocketRef.current?.send(
            JSON.stringify({
              type: "candidate",
              roomId,
              candidate: event.candidate,
              sender: clientId,
            })
          );
        }
      });

      PConnection.addEventListener("iceconnectionstatechange", async () => {
        if (
          PConnection.iceConnectionState === "connected" ||
          PConnection.iceConnectionState === "completed"
        ) {
          // ここでICE candidateが来るまで待つ
          pendingCandidatesRefs.current.forEach(async (candidates) => {
            candidates.forEach(async (candidate) => {
              await PConnection.addIceCandidate(candidate);
            });
            candidates.length = 0;
          });
        }
      });
    },
    [clientId, roomId]
  );
  // コールをかける
  const offerCall = useCallback(async () => {
    const { current: PConnections } = peerConnectionRefs;
    if (!PConnections) return;
    PConnections.forEach(async (PConnection) => {
      const offer = await PConnection.createOffer();
      await PConnection.setLocalDescription(offer);
      newSocketRef.current?.send(
        JSON.stringify({
          type: "offer",
          roomId,
          sdp: offer.sdp,
          sender: clientId,
        })
      );
    });
  }, [clientId, roomId]);

  // WebSocketとPeerConnectionを作成する
  const createWebSocketAndPeerConnection = useCallback(async () => {
    if (!roomId) return;
    const newSocket = new WebSocket(
      process.env.NODE_ENV === "production"
        ? `wss://api.mini-game-space.link/socket.io/?roomId=${roomId}`
        : `ws://192.168.11.6:5500/socket.io/?roomId=${roomId}`
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
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    localStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localStream);
    });
    peerConnectionRefs.current.set(roomId, peerConnection);
    addEventListeners(peerConnection);

    newSocket.onmessage = async (event) => {
      if (!event?.data) {
        return;
      }
      const data = JSON.parse(event.data);
      if (data.type === "offer") {
        const sdpData = data.sdp;
        const sender = data.sender;

        if (sender === clientId) return; // 自分自身からのofferは無視

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
            sender: data.sender,
          })
        );
        // ここでICE candidateが来るまで待つ
        pendingCandidatesRefs.current.forEach(async (candidates) => {
          candidates.forEach(async (candidate) => {
            await peerConnection.addIceCandidate(candidate);
          });
          candidates.length = 0;
        });
      } else if (data.type === "answer") {
        const sdpData = data.sdp;
        const sender = data.sender;

        if (sender === clientId) return; // 自分自身からのanswerは無視

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
        const sender = data.sender;

        if (sender === clientId) return; // 自分自身からのcandidateは無視

        if (
          peerConnection.iceConnectionState === "connected" ||
          peerConnection.iceConnectionState === "completed"
        ) {
          await peerConnection.addIceCandidate(candidate);
        } else {
          const pendingCandidates =
            pendingCandidatesRefs.current.get(roomId) || [];
          pendingCandidates.push(candidate);
          pendingCandidatesRefs.current.set(roomId, pendingCandidates);
        }
      }
    };
  }, [roomId, addEventListeners, clientId]);

  // 入室する
  const joinRoom = useCallback(async () => {
    if (!roomId) return;

    await createWebSocketAndPeerConnection();
    newSocketRef.current?.send(
      JSON.stringify({
        type: "set-client-id",
        clientId: clientId,
        roomId,
      })
    );
    offerCall();
  }, [roomId, createWebSocketAndPeerConnection, clientId, offerCall]);

  // 退室する
  const leaveRoom = useCallback(() => {
    if (newSocketRef.current) {
      newSocketRef.current.close();
    }
    if (peerConnectionRefs.current) {
      peerConnectionRefs.current.forEach((PConnection) => {
        PConnection.close();
      });
    }
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = null;
    }
    if (remoteAudioRefsState) {
      remoteAudioRefsState.forEach((remoteAudioRef) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = null;
        }
      });
    }
  }, [remoteAudioRefsState]);

  // コンポーネントがアンマウントされた時LeaveRoomを実行する
  // useEffect(() => {
  //   return () => {
  //     leaveRoom();
  //   };
  // }, [leaveRoom]);
  // リモート音声ストリームが更新されたときに、ストリームを<audio>要素に割り当てる
  useEffect(() => {
    remoteAudioStreams.forEach((stream) => {
      const remoteAudio = remoteAudioRefsState.get(stream.id);
      console.log(remoteAudio);

      if (remoteAudio && remoteAudio.current) {
        console.log("Stream info:", stream);
        remoteAudio.current.srcObject = stream;
        remoteAudio.current.play().catch((error) => {
          console.error("Audio playback failed:", error);
        });
      }
    });
  }, [remoteAudioStreams, remoteAudioRefsState]);

  // ミュート状態を変更する
  const toggleMute = () => {
    if (!peerConnectionRefs.current) return;
    peerConnectionRefs.current.forEach((PConnection) => {
      const senders = PConnection.getSenders();
      const audioSender = senders.find((sender) => sender.track);
      if (audioSender && audioSender.track) {
        audioSender.track.enabled = !audioSender.track.enabled;
        setIsMuted(!audioSender.track.enabled);
      }
    });
  };

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
          }}
        >
          Join Room
        </button>
        <button
          className="bg-red-500 rounded-md shadow-lg m-2 p-2"
          onClick={() => {
            window.location.reload();
          }}
        >
          Leave Room
        </button>
        <button
          className="bg-blue-500 rounded-md shadow-lg m-2 p-2"
          onClick={() => {
            toggleMute();
          }}
        >
          {isMuted ? "Mute中" : "Muteする"}
        </button>
      </div>

      <div className="mt-10">
        <audio ref={localAudioRef} autoPlay playsInline muted />
        {Array.from(remoteAudioRefsState.entries()).map(
          ([streamId, remoteAudioRef]) => (
            <audio
              ref={remoteAudioRef}
              key={streamId}
              autoPlay
              playsInline
              controls
            />
          )
        )}
      </div>
    </div>
  );
};

export default IndexPage;
