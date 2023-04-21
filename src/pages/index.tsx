import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import useAudioChat from "../hooks/useAudioChat";
import RemoteAudio from "../components/RemoteAudio";

const IndexPage = () => {
  const [roomId, setRoomId] = useState("");
  const currentUserUid = uuidv4();

  const {
    localAudioRef,
    remoteAudioRefs,
    handleVolumeChange,
    joinRoom,
    leaveRoom,
    toggleMute,
    isMuted,
  } = useAudioChat(roomId, currentUserUid);

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
          <RemoteAudio
            key={streamId}
            userId={streamId}
            stream={remoteAudioRef.stream}
            volume={remoteAudioRef.volume}
            onVolumeChange={handleVolumeChange}
          />
        ))}
      </div>
    </div>
  );
};

export default IndexPage;
