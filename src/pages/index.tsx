import React, { useState, useRef, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

const IndexPage = () => {
  const [roomId, setRoomId] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [remoteAudioRefs, setRemoteAudioRefs] = useState(new Map());
  const localAudioRef: React.RefObject<HTMLAudioElement> =
    useRef<HTMLAudioElement>(null);
  const peerConnectionRefs = useRef(new Map());
  const currentUserUid = uuidv4();

  const onIceCandidate = useCallback(
    (event: any, userId: string, newSocket: WebSocket) => {
      if (event.candidate) {
        newSocket.send(
          JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate,
            userId: currentUserUid,
            toUserId: userId,
            roomId: roomId,
          })
        );
      }
    },
    [currentUserUid, roomId]
  );

  const onTrack = (event: any, userId: string) => {
    const remoteStream = event.streams[0];
    setRemoteAudioRefs((prevRemoteAudioRefs) => {
      const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
      newRemoteAudioRefs.set(userId, {
        ref: React.createRef(),
        stream: remoteStream,
        volume: 1,
      });
      return newRemoteAudioRefs;
    });
  };
  const handleVolumeChange = (userId: string, volume: number) => {
    setRemoteAudioRefs((prevRemoteAudioRefs) => {
      const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
      const remoteAudioRef = newRemoteAudioRefs.get(userId);
      if (remoteAudioRef) {
        remoteAudioRef.volume = volume;
        if (remoteAudioRef.ref.current) {
          remoteAudioRef.ref.current.volume = volume;
        }
      }
      return newRemoteAudioRefs;
    });
  };

  const onConnectionStateChange = (
    peerConnection: RTCPeerConnection,
    userId: string
  ) => {
    if (
      peerConnection.connectionState === "failed" ||
      peerConnection.connectionState === "closed" ||
      peerConnection.connectionState === "disconnected"
    ) {
      setRemoteAudioRefs((prevRemoteAudioRefs) => {
        const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
        newRemoteAudioRefs.delete(userId);
        return newRemoteAudioRefs;
      });
    }
  };

  const createPeerConnection = useCallback(
    (userId: string, localStream: MediaStream, newSocket: WebSocket) => {
      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.onicecandidate = (event) =>
        onIceCandidate(event, userId, newSocket);
      peerConnection.ontrack = (event) => onTrack(event, userId);
      peerConnection.onconnectionstatechange = () =>
        onConnectionStateChange(peerConnection, userId);

      return peerConnection;
    },
    [onIceCandidate]
  );

  const joinRoom = useCallback(async () => {
    if (!roomId) return;

    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }
    const ws =
      process.env.NODE_ENV === "production"
        ? `wss://api.mini-game-space.link/socket.io/`
        : `ws://192.168.11.6:5500/socket.io/`;

    const newSocket = new WebSocket(ws);
    newSocket.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      const { type, userId, toUserId, connectedUserIds } = data;

      if (type === "client-joined") {
        const existingPeerConnection = peerConnectionRefs.current.get(userId);
        if (!existingPeerConnection) {
          const newPeerConnection = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });

          localStream.getTracks().forEach((track) => {
            newPeerConnection.addTrack(track, localStream);
          });

          newPeerConnection.onicecandidate = (event) => {
            if (event.candidate) {
              newSocket.send(
                JSON.stringify({
                  type: "ice-candidate",
                  candidate: event.candidate,
                  userId: currentUserUid,
                  toUserId: userId,
                  roomId: roomId,
                })
              );
            }
          };

          newPeerConnection.ontrack = (event) => {
            console.log("ontrack event:", event);
            const remoteStream = event.streams[0];
            setRemoteAudioRefs((prevRemoteAudioRefs) => {
              const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
              newRemoteAudioRefs.set(userId, {
                ref: React.createRef(),
                stream: remoteStream,
              });
              return newRemoteAudioRefs;
            });
          };

          peerConnectionRefs.current.set(userId, newPeerConnection);
        }
        const newUserIds = connectedUserIds.filter(
          (id: string) =>
            !peerConnectionRefs.current.has(id) && id !== currentUserUid
        );
        await Promise.all(
          newUserIds.map(async (otherUserId: string) => {
            let peerConnection = peerConnectionRefs.current.get(otherUserId);

            if (!peerConnection) {
              peerConnection = createPeerConnection(
                otherUserId,
                localStream,
                newSocket
              );
            }
            peerConnectionRefs.current.set(otherUserId, peerConnection);

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            newSocket.send(
              JSON.stringify({
                type: "offer",
                sdp: offer.sdp,
                userId: currentUserUid,
                toUserId: otherUserId,
                roomId: roomId,
              })
            );
          })
        );
      } else if (
        type === "offer" &&
        currentUserUid !== userId &&
        currentUserUid === toUserId
      ) {
        const { sdp } = data;

        let peerConnection = peerConnectionRefs.current.get(userId);

        if (!peerConnection) {
          peerConnection = createPeerConnection(userId, localStream, newSocket);
          peerConnectionRefs.current.set(userId, peerConnection);
        }
        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "offer", sdp })
          );
          const answer = await peerConnection.createAnswer();
          console.log("Created answer:", answer);
          await peerConnection.setLocalDescription(answer);
          newSocket.send(
            JSON.stringify({
              type: "answer",
              sdp: answer.sdp,
              userId: currentUserUid,
              toUserId: userId,
              roomId: roomId,
            })
          );
        }
      } else if (type === "answer") {
        const { sdp, userId } = data;
        const peerConnection = peerConnectionRefs.current.get(userId);

        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp })
          );
        }
      } else if (
        type === "ice-candidate" &&
        peerConnectionRefs.current.has(userId) &&
        currentUserUid === toUserId
      ) {
        const { candidate } = data;
        const peerConnection = peerConnectionRefs.current.get(userId);

        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    };

    newSocket.onopen = () => {
      newSocket.send(
        JSON.stringify({ type: "join-room", roomId, userId: currentUserUid })
      );
    };
  }, [roomId, currentUserUid, createPeerConnection]);

  useEffect(() => {
    setIsMuted(false);
  }, []);
  useEffect(() => {
    remoteAudioRefs.forEach(({ ref, stream }) => {
      if (ref.current && ref.current.srcObject !== stream) {
        ref.current.srcObject = stream;
      }
    });
  }, [remoteAudioRefs]);

  // Leave Room 機能を追加するために、新しい useCallback 関数を作成します。
  const leaveRoom = useCallback(() => {
    peerConnectionRefs.current.forEach((peerConnection) => {
      peerConnection.close();
    });
    peerConnectionRefs.current.clear();
    setRemoteAudioRefs(new Map());
  }, []);

  // Mute 機能を追加するために、新しい useCallback 関数を作成します。
  const toggleMute = useCallback(() => {
    if (localAudioRef.current) {
      const localStream = localAudioRef.current.srcObject;
      if (localStream instanceof MediaStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.enabled = !track.enabled;
        });
        setIsMuted((prevState) => !prevState);
      }
    }
  }, []);

  useEffect(() => {
    remoteAudioRefs.forEach(({ ref }) => {
      if (ref.current && ref.current.paused) {
        ref.current.play().catch((error: any) => {
          console.error("Error while trying to play remote audio:", error);
        });
      }
    });
  }, [remoteAudioRefs]);

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
            leaveRoom();
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
        {Array.from(remoteAudioRefs).map(([streamId, remoteAudioRef]) => (
          <div key={streamId}>
            <audio
              ref={remoteAudioRef.ref}
              key={streamId}
              autoPlay
              playsInline
              controls
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={remoteAudioRef.volume}
              onChange={(e) =>
                handleVolumeChange(streamId, parseFloat(e.target.value))
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default IndexPage;
