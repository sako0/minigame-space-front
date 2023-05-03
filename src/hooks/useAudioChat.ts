import React from "react";
import { useState, useRef, useCallback, useEffect } from "react";

type RemoteAudioRef = {
  ref: React.RefObject<HTMLAudioElement>;
  stream: MediaStream;
  volume: number;
};

type Message = {
  type: string;
  fromFirebaseUid: string;
  toFirebaseUid: string;
  roomId: number;
  connectedUserIds: string[];
  sdp: any;
  candidate: RTCIceCandidate;
};

const useAudioChat = (roomId: number, currentUserUid: string) => {
  const [isMuted, setIsMuted] = useState(false);
  const [remoteAudioRefs, setRemoteAudioRefs] = useState<
    Map<string, RemoteAudioRef>
  >(new Map());

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRefs = useRef(new Map());
  const socketRef = useRef<WebSocket | null>(null);

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null); // audioContextの状態を追加

  const createPeerConnection = useCallback(
    (toFirebaseUid: string, localStream: MediaStream) => {
      if (!socketRef.current) return;
      const onIceCandidate = (event: any) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: event.candidate,
              fromFirebaseUid: currentUserUid,
              toFirebaseUid: toFirebaseUid,
              roomId: roomId,
            })
          );
        }
      };

      const onTrack = (event: any) => {
        const remoteStream = event.streams[0];
        setRemoteAudioRefs((prevRemoteAudioRefs) => {
          const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
          newRemoteAudioRefs.set(toFirebaseUid, {
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
            newRemoteAudioRefs.delete(toFirebaseUid);
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
    async (event: MessageEvent) => {
      if (!socketRef.current) return;

      const data: Message = JSON.parse(event.data);
      const { type, fromFirebaseUid, toFirebaseUid, connectedUserIds } = data;
      const localStream = localAudioRef.current?.srcObject as MediaStream;

      if (type === "client-joined") {
        const existingPeerConnection =
          peerConnectionRefs.current.get(fromFirebaseUid);
        if (!existingPeerConnection) {
          const newPeerConnection = createPeerConnection(
            toFirebaseUid,
            localStream
          );
          peerConnectionRefs.current.set(toFirebaseUid, newPeerConnection);
        }
        const newUserIds = connectedUserIds.filter(
          (id: string) =>
            !peerConnectionRefs.current.has(id) && id !== currentUserUid
        );
        await Promise.all(
          newUserIds.map(async (otherUserId: string) => {
            let peerConnection = peerConnectionRefs.current.get(otherUserId);

            if (!peerConnection) {
              peerConnection = createPeerConnection(otherUserId, localStream);
              peerConnectionRefs.current.set(otherUserId, peerConnection);
            }

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            if (socketRef.current) {
              socketRef.current.send(
                JSON.stringify({
                  type: "offer",
                  sdp: offer.sdp,
                  fromFirebaseUid: currentUserUid,
                  toFirebaseUid: otherUserId,
                  roomId: roomId,
                })
              );
            }
          })
        );
      } else if (
        type === "offer" &&
        currentUserUid !== fromFirebaseUid &&
        currentUserUid === toFirebaseUid
      ) {
        const { sdp } = data;

        let peerConnection = peerConnectionRefs.current.get(fromFirebaseUid);

        if (!peerConnection) {
          peerConnection = createPeerConnection(fromFirebaseUid, localStream);
          peerConnectionRefs.current.set(fromFirebaseUid, peerConnection);
        }
        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "offer", sdp })
          );
          const answer = await peerConnection.createAnswer();
          console.log("Created answer:", answer);
          await peerConnection.setLocalDescription(answer);
          socketRef.current.send(
            JSON.stringify({
              type: "answer",
              sdp: answer.sdp,
              fromFirebaseUid: currentUserUid,
              toFirebaseUid: fromFirebaseUid,
              roomId: roomId,
            })
          );
        }
      } else if (type === "answer") {
        const { sdp, fromFirebaseUid } = data;
        const peerConnection = peerConnectionRefs.current.get(fromFirebaseUid);

        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp })
          );
        }
      } else if (
        type === "ice-candidate" &&
        peerConnectionRefs.current.has(fromFirebaseUid) &&
        currentUserUid !== fromFirebaseUid
      ) {
        const { candidate } = data;
        const peerConnection = peerConnectionRefs.current.get(fromFirebaseUid);

        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } else if (type === "leave-room" && currentUserUid !== toFirebaseUid) {
        const peerConnection = peerConnectionRefs.current.get(toFirebaseUid);

        if (peerConnection) {
          // イベントリスナーを削除
          peerConnection.onicecandidate = null;
          peerConnection.ontrack = null;
          peerConnection.onconnectionstatechange = null;

          // すべてのリモートストリームを削除する
          if (peerConnection.signalingState !== "closed") {
            peerConnection.getSenders().forEach((sender: any) => {
              peerConnection.removeTrack(sender);
            });
          }

          // RTCPeerConnection を閉じる
          peerConnection.close();
        }

        // RTCPeerConnection を参照から削除
        peerConnectionRefs.current.delete(toFirebaseUid);

        // RemoteAudioRef を削除
        setRemoteAudioRefs((prevRemoteAudioRefs) => {
          const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
          newRemoteAudioRefs.delete(String(toFirebaseUid));
          return newRemoteAudioRefs;
        });
      }
    },
    [socketRef, currentUserUid, createPeerConnection, roomId]
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
    if (!localAudioRef.current) return;

    localAudioRef.current.srcObject = localStream;

    const ws =
      process.env.NODE_ENV === "production"
        ? `wss://api.mini-game-space.link/signaling`
        : `ws://192.168.11.6:5500/signaling`;

    const newSocket = new WebSocket(ws);
    socketRef.current = newSocket;
    peerConnectionRefs.current.clear();
    if (socketRef.current) {
      socketRef.current.onopen = () => {
        if (!socketRef.current) return;
        socketRef.current.send(
          JSON.stringify({
            type: "join-room",
            roomId,
            fromFirebaseUid: currentUserUid,
          })
        );
      };
      socketRef.current.onmessage = (event: MessageEvent) => {
        handleMessage(event);
      };
      socketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    }
  }, [roomId, audioContext, handleMessage, currentUserUid]);

  const leaveRoom = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.send(
        JSON.stringify({
          type: "leave-room",
          userId: currentUserUid,
          roomId,
        })
      );
    }

    remoteAudioRefs.forEach(({ ref }) => {
      if (ref.current) {
        ref.current.srcObject = null;
      }
    });
    // ローカルのAudio要素のsrcObjectをnullに設定し再生を停止
    if (localAudioRef.current) {
      const localStream = localAudioRef.current.srcObject;
      if (localStream instanceof MediaStream) {
        localStream.getAudioTracks().forEach((track) => {
          track.stop();
        });
        localAudioRef.current.srcObject = null;
      }
    }

    // リモートとのコネクションを全て閉じる
    peerConnectionRefs.current.forEach((peerConnection) => {
      // イベントリスナーを削除
      peerConnection.onicecandidate = null;
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      // すべてのリモートストリームを削除する
      peerConnection.getSenders().forEach((sender: any) => {
        peerConnection.removeTrack(sender);
      });
      // RTCPeerConnectionを閉じる
      peerConnection.close();
    });
    peerConnectionRefs.current.clear();

    setRemoteAudioRefs(new Map());
    // WebSocket接続を閉じていく
    if (socketRef.current) {
      // WebSocketのイベントリスナーを削除
      socketRef.current.onmessage = null;
      socketRef.current.onopen = null;
      socketRef.current.onerror = null;
      socketRef.current.onclose = null;
      // WebSocket接続を閉じる
      const socket = socketRef.current;
      socketRef.current = null;
      socket.close();
    }
  }, [currentUserUid, remoteAudioRefs, roomId]);

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

  const handleVolumeChange = useCallback((userId: string, volume: number) => {
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
  }, []);

  useEffect(() => {
    remoteAudioRefs.forEach(({ ref, stream }) => {
      if (ref.current && ref.current.srcObject !== stream) {
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
