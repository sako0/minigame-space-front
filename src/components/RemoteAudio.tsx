import React, { useEffect, useRef, useState } from "react";

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

    if (audioContext) {
      const analyser = audioContext.createAnalyser();
      analyser.smoothingTimeConstant = 0.3;
      analyser.fftSize = 2048;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const audioSource = audioContext.createMediaStreamSource(stream);
      gainNode.current = audioContext.createGain();
      gainNode.current.gain.value = volume;
      audioSource.connect(analyser);
      analyser.connect(gainNode.current);

      const destination = audioContext.createMediaStreamDestination();
      gainNode.current.connect(destination);

      audioRef.current.srcObject = destination.stream;
      audioRef.current.play().catch((error) => {
        console.error("Error playing audio:", error);
      });

      const updateAudioLevel = () => {
        analyser.getByteTimeDomainData(dataArray);

        const sum = dataArray.reduce((acc, value) => {
          const difference = (value - 128) / 128;
          return acc + difference * difference;
        }, 0);
        const rms = Math.sqrt(sum / bufferLength);
        const thresholds = [0.002, 0.005, 0.01, 0.02]; // 閾値
        const level = thresholds.findIndex((threshold) => rms < threshold);
        setTalkingLevel(level);
        requestAnimationFrame(updateAudioLevel);
      };

      updateAudioLevel();

      return () => {
        audioSource.disconnect();
        analyser.disconnect();
        gainNode.current?.disconnect();
      };
    }
  }, [stream, volume]);

  useEffect(() => {
    if (!stream) return;
    if (!audioRef.current) return;
    if (audioContext) return;

    audioRef.current.srcObject = stream;
    audioRef.current.play().catch((error) => {
      console.error("Error playing audio:", error);
    });
  }, [stream]);

  useEffect(() => {
    if (gainNode.current) {
      console.log("volume", volume);
      console.log("gainNode.current.gain.value", gainNode.current.gain.value);

      gainNode.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (audioRef.current) {
      console.log("audioRef.current.volume", audioRef.current.volume);
    }
  }, [volume]);

  const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onVolumeChange(userId, parseFloat(event.target.value));
  };
  const greenIntensity = Math.floor((255 / 4) * talkingLevel);
  const alpha = talkingLevel > 0 ? 1 : 0.5;
  const textColor = `rgba(0, ${greenIntensity}, 0, ${alpha})`;

  return (
    <div className="my-3">
      <audio ref={audioRef} playsInline />
      <div className="flex items-center justify-center mx-auto">
        <p className={"text-sm "}>{userId}</p>
        <div
          className="rounded-full w-6 h-6 ml-3"
          style={{
            backgroundColor: textColor,
            display: "inline-block",
            marginRight: "0.5rem",
            color: textColor,
          }}
        />
      </div>
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
