import React, { useEffect, useRef, useState } from "react";

// クライアントサイドでのみ AudioContext を作成
const audioContext = typeof window !== "undefined" ? new AudioContext() : null;

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
  const gainNode = useRef<GainNode | null>(null);
  const [talkingLevel, setTalkingLevel] = useState(0);

  useEffect(() => {
    if (!stream) return;
    if (!audioRef.current) return;
    if (!audioContext) return;

    const analyser = audioContext.createAnalyser();
    const audioSource = audioContext.createMediaStreamSource(stream);
    const destination = audioContext.createMediaStreamDestination();
    gainNode.current = audioContext.createGain();

    audioSource.connect(analyser);
    analyser.connect(gainNode.current);
    gainNode.current.connect(destination);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 2048;

    const updateAudioLevel = () => {
      analyser.getByteTimeDomainData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        const difference = dataArray[i] - 128;
        sum += difference * difference;
      }
      const rms = Math.sqrt(sum / bufferLength);
      const thresholds = [1, 2, 4, 5]; // 5段階の音量しきい値
      const level = thresholds.findIndex((threshold) => rms < threshold);
      setTalkingLevel(level);
      requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    return () => {
      if (audioSource) audioSource.disconnect(analyser);
      if (gainNode.current) {
        analyser.disconnect(gainNode.current);
        gainNode.current.disconnect(destination);
      }
    };
  }, [stream]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.srcObject = stream;
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });
    }
  }, [stream]);

  useEffect(() => {
    if (gainNode.current) {
      gainNode.current.gain.value = volume;
    }
  }, [volume]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onVolumeChange(userId, parseFloat(event.target.value));
  };
  const greenIntensity = Math.floor((255 / 4) * talkingLevel);
  const textColor = `rgb(0, ${greenIntensity}, 0)`;

  return (
    <div className="my-3">
      <audio ref={audioRef} playsInline />
      <p className={"text-sm "} style={{ color: textColor }}>
        {userId}
      </p>
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
