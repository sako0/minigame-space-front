import React from "react";
import { useState, useRef, useCallback, useEffect } from "react";

type UseAudioChatProps = {
  roomID: number;
  currentUserUid: number;
  socket: React.MutableRefObject<WebSocket | null>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
};

type RemoteAudioRef = {
  ref: React.RefObject<HTMLAudioElement>;
  stream: MediaStream;
  volume: number;
};

type Message = {
  type: string;
  fromUserID: number;
  toUserID: number;
  roomID: number;
  connectedUserIds: number[];
  sdp: any;
  candidate: RTCIceCandidate;
};

const nowTime = () => {
  // 現在の時刻を取得
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const second = now.getSeconds();

  return hour + ":" + minute + ":" + second;
};

const joinMessageType = "join-audio";
const leaveMessageType = "leave-audio";
const disconnectMessageType = "disconnect-audio";

const useAudioChat = (props: UseAudioChatProps) => {
  const {
    roomID,
    currentUserUid,
    socket,
    connectWebSocket,
    disconnectWebSocket,
  } = props;
  const [isMuted, setIsMuted] = useState(false);
  const [remoteAudioRefs, setRemoteAudioRefs] = useState<
    Map<string, RemoteAudioRef>
  >(new Map());

  const localAudioRef = useRef<HTMLAudioElement>(null);
  const peerConnectionRefs = useRef(new Map());

  const [audioContext, setAudioContext] = useState<AudioContext | null>(null); // audioContextの状態を追加

  const createPeerConnection = useCallback(
    (toUserID: number, localStream: MediaStream) => {
      if (!socket.current) return;
      const onIceCandidate = (event: any) => {
        if (event.candidate && socket.current) {
          socket.current.send(
            JSON.stringify({
              type: "ice-candidate",
              candidate: event.candidate,
              fromUserID: currentUserUid,
              toUserID: toUserID,
              roomID: roomID,
            })
          );
        }
      };

      const onTrack = (event: RTCTrackEvent) => {
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          setRemoteAudioRefs((prevRemoteAudioRefs) => {
            const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
            newRemoteAudioRefs.set(String(toUserID), {
              ref: React.createRef(),
              stream: remoteStream,
              volume: 1,
            });
            return newRemoteAudioRefs;
          });
        }
      };

      const onConnectionStateChange = (peerConnection: RTCPeerConnection) => {
        if (
          peerConnection.connectionState === "failed" ||
          peerConnection.connectionState === "closed" ||
          peerConnection.connectionState === "disconnected"
        ) {
          setRemoteAudioRefs((prevRemoteAudioRefs) => {
            const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
            newRemoteAudioRefs.delete(String(toUserID));
            return newRemoteAudioRefs;
          });
          // 再接続を試みる
          connectWebSocket();
          if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            socket.current.send(
              JSON.stringify({
                type: joinMessageType,
                roomID,
                fromUserID: currentUserUid,
              })
            );
          }
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
    [connectWebSocket, currentUserUid, roomID, socket]
  );

  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (!socket.current) return;

      const data: Message = JSON.parse(event.data);
      const { type, fromUserID, toUserID, connectedUserIds } = data;
      const localStream = localAudioRef.current?.srcObject as MediaStream;

      if (type === joinMessageType) {
        const existingPeerConnection =
          peerConnectionRefs.current.get(fromUserID);
        if (!existingPeerConnection) {
          const newPeerConnection = createPeerConnection(toUserID, localStream);
          peerConnectionRefs.current.set(toUserID, newPeerConnection);
        }
        console.log("connectedUserIds:", connectedUserIds);
        console.log("currentUserUid:", currentUserUid);

        const newUserIds = connectedUserIds.filter(
          (id) => !peerConnectionRefs.current.has(id) && id !== currentUserUid
        );
        console.log("newUserIds:", newUserIds);
        console.log(newUserIds[0], "が入室しました。時刻:" + nowTime());

        await Promise.all(
          newUserIds.map(async (otherUserId) => {
            let peerConnection = peerConnectionRefs.current.get(otherUserId);

            if (!peerConnection) {
              peerConnection = createPeerConnection(otherUserId, localStream);
              peerConnectionRefs.current.set(otherUserId, peerConnection);
            }

            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            if (
              socket.current &&
              socket.current.readyState === WebSocket.OPEN
            ) {
              socket.current.send(
                JSON.stringify({
                  type: "offer",
                  sdp: offer.sdp,
                  fromUserID: currentUserUid,
                  toUserID: otherUserId,
                  roomID: roomID,
                })
              );
            }
          })
        );
      } else if (
        type === "offer" &&
        currentUserUid !== fromUserID &&
        currentUserUid === toUserID
      ) {
        const { sdp } = data;

        let peerConnection = peerConnectionRefs.current.get(fromUserID);

        if (!peerConnection) {
          peerConnection = createPeerConnection(fromUserID, localStream);
          peerConnectionRefs.current.set(fromUserID, peerConnection);
        }
        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "offer", sdp })
          );
          const answer = await peerConnection.createAnswer();
          console.log("Created answer:", answer);
          await peerConnection.setLocalDescription(answer);
          if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            socket.current.send(
              JSON.stringify({
                type: "answer",
                sdp: answer.sdp,
                fromUserID: currentUserUid,
                toUserID: fromUserID,
                roomID: roomID,
              })
            );
          }
        }
      } else if (type === "answer") {
        const { sdp, fromUserID, toUserID } = data;
        if (toUserID !== currentUserUid) return;
        const peerConnection = peerConnectionRefs.current.get(fromUserID);

        if (peerConnection) {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription({ type: "answer", sdp })
          );
        }
      } else if (
        type === "ice-candidate" &&
        peerConnectionRefs.current.has(fromUserID) &&
        currentUserUid !== fromUserID
      ) {
        const { candidate } = data;
        const peerConnection = peerConnectionRefs.current.get(fromUserID);

        if (peerConnection) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } else if (
        (type === leaveMessageType || type === disconnectMessageType) &&
        currentUserUid !== fromUserID
      ) {
        console.log(fromUserID, "が退出しました。時刻: " + nowTime());

        const peerConnection = peerConnectionRefs.current.get(fromUserID);

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
        peerConnectionRefs.current.delete(fromUserID);

        // RemoteAudioRef を削除
        setRemoteAudioRefs((prevRemoteAudioRefs) => {
          const newRemoteAudioRefs = new Map(prevRemoteAudioRefs);
          newRemoteAudioRefs.delete(String(fromUserID));
          return newRemoteAudioRefs;
        });
      }
    },
    [socket, currentUserUid, createPeerConnection, roomID]
  );

  const leaveAudioChat = useCallback(() => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.send(
        JSON.stringify({
          type: leaveMessageType,
          fromUserID: currentUserUid,
          roomID,
        })
      );
    }
    // WebSocket のイベントリスナーを削除
    if (socket.current) {
      socket.current.removeEventListener("open", connectWebSocket);
      socket.current.removeEventListener("message", handleMessage);
      socket.current.removeEventListener("error", disconnectWebSocket);
      socket.current.removeEventListener("close", disconnectWebSocket);
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
        if (peerConnection && peerConnection.signalingState !== "closed") {
          peerConnection.removeTrack(sender);
        }
      });
      // RTCPeerConnectionを閉じる
      peerConnection.close();
    });
    peerConnectionRefs.current.clear();

    setRemoteAudioRefs(new Map());
    // WebSocket接続を閉じていく
    disconnectWebSocket();
  }, [
    connectWebSocket,
    currentUserUid,
    disconnectWebSocket,
    handleMessage,
    remoteAudioRefs,
    roomID,
    socket,
  ]);

  const joinAudioChat = useCallback(async () => {
    if (!roomID) return;

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

    peerConnectionRefs.current.clear();
    connectWebSocket();
    if (socket.current) {
      socket.current.addEventListener("open", () => {
        console.log("音声通話を開始します");

        if (socket.current && socket.current.readyState === WebSocket.OPEN) {
          socket.current.send(
            JSON.stringify({
              type: joinMessageType,
              roomID,
              fromUserID: currentUserUid,
            })
          );
        }
      });
      socket.current.addEventListener("message", (event: MessageEvent) => {
        handleMessage(event);
      });
      socket.current.addEventListener("error", (error) => {
        setTimeout(() => {
          connectWebSocket();
          if (socket.current && socket.current.readyState === WebSocket.OPEN) {
            socket.current.send(
              JSON.stringify({
                type: joinMessageType,
                roomID,
                fromUserID: currentUserUid,
              })
            );
          }
        }, 5000);
        console.error("WebSocket error:", error);
      });
      socket.current.addEventListener("close", (event) => {
        console.log("WebSocket closed:", event);
      });
    }
  }, [
    roomID,
    audioContext,
    connectWebSocket,
    socket,
    currentUserUid,
    handleMessage,
  ]);

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
    joinAudioChat,
    leaveAudioChat,
    toggleMute,
    isMuted,
    audioContext,
  };
};

export default useAudioChat;
