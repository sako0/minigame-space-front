import React, { useCallback, useEffect, useRef, useState } from "react";

// Custom hook for audio level
export const useAudioLevel = (
  audioContext: AudioContext | null,
  stream: MediaStream
) => {
  const [talkingLevel, setTalkingLevel] = useState(0);

  useEffect(() => {
    if (!stream || !audioContext) return;

    const audioSource = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.smoothingTimeConstant = 0.3;
    analyser.fftSize = 2048;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    audioSource.connect(analyser);

    const updateAudioLevel = () => {
      analyser.getByteTimeDomainData(dataArray);

      const sum = dataArray.reduce((acc, value) => {
        const difference = (value - 128) / 128;
        return acc + difference * difference;
      }, 0);
      const rms = Math.sqrt(sum / bufferLength);
      const thresholds = [0.007, 0.01, 0.02, 0.025];
      const level = thresholds.findIndex((threshold) => rms < threshold);
      setTalkingLevel(level);
      requestAnimationFrame(updateAudioLevel);
    };

    updateAudioLevel();

    return () => {
      audioSource.disconnect();
      analyser.disconnect();
    };
  }, [audioContext, stream]);

  return talkingLevel;
};
