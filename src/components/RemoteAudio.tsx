import React, { useEffect, useRef } from "react";

interface RemoteAudioProps {
  userId: string;
  stream: MediaStream;
  volume: number;
  onVolumeChange: (userId: string, volume: number) => void;
}

const RemoteAudio: React.FC<RemoteAudioProps> = ({
  userId,
  stream,
  volume,
  onVolumeChange,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  // const audioLevel = useAudioLevelMonitor({ stream });
  // console.log(audioLevel);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onVolumeChange(userId, parseFloat(event.target.value));
  };

  return (
    <div>
      <audio ref={audioRef} autoPlay />
      <label htmlFor={`${userId}-volume`}>Volume:</label>
      <input
        id={`${userId}-volume`}
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onChange={handleVolumeChange}
      />
    </div>
  );
};

export default RemoteAudio;
