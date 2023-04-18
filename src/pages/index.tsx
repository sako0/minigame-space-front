import React, { useState, useRef, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";

const IndexPage = () => {
  const [roomId, setRoomId] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [remoteAudioRefs, setRemoteAudioRefs] = useState(new Map());
  const localAudioRef: React.RefObject<HTMLAudioElement> =
    useRef<HTMLAudioElement>(null);

  // const remoteAudioRefs = useRef(new Map());
  const peerConnectionRefs = useRef(new Map());
  const userId = uuidv4();

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
      const { type, clientId } = data;

      if (type === "client-joined") {
        const { connectedUserIds } = data;
        const newUserIds = connectedUserIds.filter(
          (id: string) => !peerConnectionRefs.current.has(id)
        );
        newUserIds.forEach(async (userId: string) => {
          const peerConnection = new RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });

          localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
          });

          peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
              newSocket.send(
                JSON.stringify({
                  type: "ice-candidate",
                  candidate: event.candidate,
                  userId: userId,
                  roomId: roomId,
                })
              );
            }
          };

          peerConnection.ontrack = (event) => {
            console.log("ontrack event:", event);
            const remoteStream = event.streams[0];
            setRemoteAudioRefs((prevRemoteAudioRefs) => {
              const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
              newRemoteAudioRefs.set(clientId, {
                ref: React.createRef(),
                stream: remoteStream,
              });
              return newRemoteAudioRefs;
            });
          };
          if (peerConnection) {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            newSocket.send(
              JSON.stringify({
                type: "offer",
                sdp: offer.sdp,
                userId: userId,
                roomId: roomId,
              })
            );
          }

          peerConnectionRefs.current.set(userId, peerConnection);
        });
      } else if (type === "offer") {
        const { sdp, clientId } = data;
        console.log("peerConnectionRefs:", peerConnectionRefs.current);
        console.log("clientId:", clientId);

        const peerConnection = peerConnectionRefs.current.get(clientId);
        console.log("peerConnection:", peerConnection);
        if (peerConnection) {
          console.log("offer from clientId:", clientId);
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "offer", sdp })
          );
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          newSocket.send(
            JSON.stringify({
              type: "answer",
              sdp: answer.sdp,
              userId: clientId,
              roomId: roomId,
            })
          );
        }
      } else if (type === "answer") {
        const { sdp, clientId } = data;
        const peerConnection = peerConnectionRefs.current.get(clientId);

        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp })
          );
        }
      } else if (type === "ice-candidate") {
        const { candidate, clientId } = data;
        const peerConnection = peerConnectionRefs.current.get(clientId);

        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }
    };

    newSocket.onopen = () => {
      newSocket.send(JSON.stringify({ type: "join-room", roomId, userId }));
    };
  }, [roomId, userId]);

  useEffect(() => {
    setIsMuted(false);
  }, []);
  useEffect(() => {
    console.log("remoteAudioRefs.current:", remoteAudioRefs);
    remoteAudioRefs.forEach(({ ref, stream }) => {
      if (ref.current && ref.current.srcObject !== stream) {
        ref.current.srcObject = stream;
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
            // leaveRoom();
          }}
        >
          Leave Room
        </button>
        <button
          className="bg-blue-500 rounded-md shadow-lg m-2 p-2"
          onClick={() => {
            // toggleMute();
          }}
        >
          {isMuted ? "Mute中" : "Muteする"}
        </button>
      </div>

      <div className="mt-10">
        <audio ref={localAudioRef} autoPlay playsInline muted />
        {Array.from(remoteAudioRefs).map(([streamId, remoteAudioRef]) => (
          <audio
            ref={remoteAudioRef.ref}
            key={streamId}
            autoPlay
            playsInline
            controls
          />
        ))}
      </div>
    </div>
  );
};

export default IndexPage;
