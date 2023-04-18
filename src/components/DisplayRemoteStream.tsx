import { useRef, useEffect } from "react";

type DisplayRemoteStreamProps = {
  stream: MediaStream | null;
  userId: string;
};

export const DisplayRemoteStream: React.FC<DisplayRemoteStreamProps> = ({
  stream,
  userId,
}) => {
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (remoteAudioRef.current && stream) {
      remoteAudioRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <audio
      ref={remoteAudioRef}
      id={`remoteAudio-${userId}`}
      autoPlay
      playsInline
    />
  );
};
