import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import useAudioChat from "../hooks/useAudioChat";
import RemoteAudio from "../components/RemoteAudio";
import { useWebSocket } from "@/hooks/useWebSocket";

const IndexPage = () => {
  const [roomID, setRoomId] = useState<number>();
  const [userId, setUserId] = useState<number>();
  // const uid = uuidv4();
  // const [currentUserUid] = useState(uid);
  const url =
    process.env.NODE_ENV === "production"
      ? `wss://api.mini-game-space.link/ws`
      : `ws://192.168.11.6:5500/ws`;
  const { socket, connectWebSocket, disconnectWebSocket } = useWebSocket(url);

  const {
    localAudioRef,
    remoteAudioRefs,
    handleVolumeChange,
    joinRoom,
    leaveRoom,
    toggleMute,
    isMuted,
    audioContext,
  } = useAudioChat({
    roomID: roomID ?? 0,
    currentUserUid: userId ?? 0,
    socket,
    connectWebSocket,
    disconnectWebSocket,
  });

  return (
    <div className="text-center">
      <div>
        <input
          className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black w-12"
          placeholder="ルームID"
          type="text"
          value={roomID === 0 ? "" : roomID}
          onChange={(e) => setRoomId(Number(e.target.value))}
        />
        <input
          className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black"
          placeholder="ユーザーID"
          type="text"
          value={userId === 0 ? "" : userId}
          onChange={(e) => setUserId(Number(e.target.value))}
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
          <RemoteAudio
            key={streamId}
            userId={streamId}
            stream={remoteAudioRef.stream}
            volume={remoteAudioRef.volume}
            onVolumeChange={handleVolumeChange}
            audioContext={audioContext}
          />
        ))}
      </div>
    </div>
  );
};

export default IndexPage;
