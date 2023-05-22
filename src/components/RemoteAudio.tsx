import { useAudioLevel } from "@/hooks/useAudioLevel";
import { useRef, useState, useCallback, useEffect } from "react";
import { GreenCircle } from "./GreenCircle";

type RemoteAudioProps = {
  userId: string;
  stream: MediaStream;
  volume: number;
  onVolumeChange: (userId: string, volume: number) => void;
  audioContext: AudioContext | null;
};

const RemoteAudio: React.FC<RemoteAudioProps> = ({
  userId,
  stream,
  volume,
  onVolumeChange,
  audioContext,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const talkingLevel = useAudioLevel(audioContext, stream);

  const playAudio = useCallback(async () => {
    if (!audioRef.current) return;
    if (isPlaying) return;
    audioRef.current.play().then(() => {
      setIsPlaying(true);
    });
  }, [isPlaying]);

  useEffect(() => {
    if (!stream) return;
    if (!audioRef.current) return;
    if (!audioContext) return;
    const audioElement = audioRef.current;
    audioElement.addEventListener("canplay", playAudio);
    if (audioRef.current.srcObject !== stream) {
      audioRef.current.srcObject = stream;
    }

    return () => {
      audioElement.removeEventListener("canplay", playAudio);
    };
  }, [audioContext, isPlaying, playAudio, stream]);

  useEffect(() => {
    if (audioContext) {
      audioContext.resume();
    }
  }, [audioContext]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onVolumeChange(userId, parseFloat(event.target.value));
  };

  return (
    <div className="my-3">
      <audio ref={audioRef} playsInline autoPlay />
      <div className="flex items-center justify-center mx-auto">
        <p className={"text-sm text-black"}>{userId}</p>
        <GreenCircle talkingLevel={talkingLevel} />
      </div>
      <input
        onClick={(e) => e.stopPropagation()}
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
