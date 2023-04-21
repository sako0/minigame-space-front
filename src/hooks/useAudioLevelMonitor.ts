import { useEffect, useState } from "react";

type useAudioLevelMonitorProps = {
  stream: MediaStream;
};

function useAudioLevelMonitor({ stream }: useAudioLevelMonitorProps) {
  const [audioLevel, setAudioLevel] = useState(0);

  useEffect(() => {
    if (!stream) return;

    let animationFrameId = 0;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const audioSource = audioContext.createMediaStreamSource(stream);
    audioSource.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 2048;

    const updateAudioLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const sum = dataArray.reduce((acc, val) => acc + val, 0);

      const average = sum / bufferLength;
      setAudioLevel(average);
      requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (audioSource) audioSource.disconnect(analyser);
      if (analyser) analyser.disconnect(audioContext.destination);
    };
  }, [stream]);

  return audioLevel;
}

export default useAudioLevelMonitor;
