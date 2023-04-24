import React from "react";
import { useState, useRef, useCallback, useEffect } from "react";

type RemoteAudioRef = {
  ref: React.RefObject<HTMLAudioElement>;
  stream: MediaStream;
  volume: number;
};

const useAudioChat = (roomId: string, currentUserUid: string) => {
  const [isMuted, setIsMuted] = useState(false);
  const [remoteAudioRefs, setRemoteAudioRefs] = useState<
    Map<string, RemoteAudioRef>
  >(new Map());

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRefs = useRef(new Map());
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null); // audioContextの状態を追加

  const createPeerConnection = useCallback(
    (userId: string, localStream: MediaStream, newSocket: WebSocket) => {
      const onIceCandidate = (event: any) => {
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

      const onTrack = (event: any) => {
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

      const onConnectionStateChange = (peerConnection: RTCPeerConnection) => {
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

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.onicecandidate = onIceCandidate;
      peerConnection.ontrack = onTrack;
      peerConnection.onconnectionstatechange = () =>
        onConnectionStateChange(peerConnection);

      return peerConnection;
    },
    [currentUserUid, roomId]
  );

  const handleMessage = useCallback(
    async (event: MessageEvent, newSocket: WebSocket) => {
      const data = JSON.parse(event.data);
      const { type, userId, toUserId, connectedUserIds } = data;
      const localStream = localAudioRef.current?.srcObject as MediaStream;

      if (type === "client-joined") {
        const existingPeerConnection = peerConnectionRefs.current.get(userId);
        if (!existingPeerConnection) {
          const newPeerConnection = createPeerConnection(
            userId,
            localStream,
            newSocket
          );
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
              peerConnectionRefs.current.set(otherUserId, peerConnection);
            }

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
    },
    [roomId, currentUserUid, createPeerConnection]
  );

  const joinRoom = useCallback(async () => {
    if (!roomId) return;
    if (!audioContext) {
      const newAudioContext = new AudioContext();
      setAudioContext(newAudioContext);
      await newAudioContext.resume();
    }
    const localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
    });

    if (localAudioRef.current) {
      localAudioRef.current.srcObject = localStream;
    }
    const ws =
      process.env.NODE_ENV === "production"
        ? `wss://api.mini-game-space.link/signaling`
        : `ws://192.168.11.6:5500/signaling`;

    const newSocket = new WebSocket(ws);

    newSocket.onmessage = (event: MessageEvent) =>
      handleMessage(event, newSocket);

    newSocket.onopen = () => {
      newSocket.send(
        JSON.stringify({ type: "join-room", roomId, userId: currentUserUid })
      );
    };
  }, [roomId, audioContext, handleMessage, currentUserUid]);

  const leaveRoom = useCallback(() => {
    // ローカルのAudio要素のsrcObjectをnullに設定し再生を停止
    if (localAudioRef.current) {
      const localStream = localAudioRef.current.srcObject as MediaStream;
      if (localStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.stop();
        });
      }
      localAudioRef.current.srcObject = null;
    }

    // リモートとのコネクションを全て閉じる
    peerConnectionRefs.current.forEach((peerConnection) => {
      // すべてのリモートストリームを削除する
      peerConnection.getSenders().forEach((sender: any) => {
        peerConnection.removeTrack(sender);
      });
      // RTCPeerConnectionを閉じる
      peerConnection.close();
    });
    peerConnectionRefs.current.clear();
    setRemoteAudioRefs(new Map());
  }, []);

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

  const handleVolumeChange = (userId: string, volume: number) => {
    setRemoteAudioRefs((prevRemoteAudioRefs) => {
      const updatedRemoteAudioRefs = new Map(prevRemoteAudioRefs);
      const audioInfo = updatedRemoteAudioRefs.get(userId);
      if (audioInfo) {
        audioInfo.volume = volume;
        if (audioInfo.ref.current) {
          audioInfo.ref.current.volume = volume;
        }
        updatedRemoteAudioRefs.set(userId, audioInfo);
      }
      return updatedRemoteAudioRefs;
    });
  };

  useEffect(() => {
    setIsMuted(false);
  }, []);

  useEffect(() => {
    remoteAudioRefs.forEach(({ ref, stream }) => {
      if (ref.current) {
        ref.current.srcObject = stream;
      }
    });
  }, [remoteAudioRefs]);

  return {
    localAudioRef,
    remoteAudioRefs,
    handleVolumeChange,
    joinRoom,
    leaveRoom,
    toggleMute,
    isMuted,
    audioContext,
  };
};

export default useAudioChat;
