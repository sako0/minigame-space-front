import { useAudioLevel } from "@/hooks/useAudioLevel";

type AudioUserIconProps = {
  userID: number;
  index: number;
  xAxis: number;
  yAxis: number;
  audioContext: AudioContext | null;
  stream: MediaStream;
};

export const AudioUserIcon = (props: AudioUserIconProps) => {
  const { userID, index, xAxis, yAxis, audioContext, stream } = props;
  const talkingLevel = useAudioLevel(audioContext, stream);
  const greenIntensity = Math.floor((255 / 4) * talkingLevel);
  const textColor =
    talkingLevel > 0
      ? `rgba(0, ${greenIntensity}, 0, 1)`
      : "rgba(128, 128, 128, 0.5)";

  const bgColor = (() => {
    switch (index) {
      case 1:
        return "bg-red-400";
      case 2:
        return "bg-blue-400";
      case 3:
        return "bg-yellow-400";
      case 4:
        return "bg-purple-400";
      case 5:
        return "bg-orange-400";
      case 6:
        return "bg-pink-400";
      default:
        return "bg-blue-400";
    }
  })();

  return (
    <div
      className="absolute transition-all duration-500 ease-linear"
      style={{
        left: `calc(${xAxis}% - 16px)`,
        top: `calc(${yAxis}% - 16px)`,
        transition: "top 0.5s, left 0.5s",
      }}
    >
      <div
        className={`flex justify-center items-center w-10 h-10 rounded-full ${bgColor}`}
        style={{
          borderColor: textColor,
          borderWidth: talkingLevel > 0 ? "4px" : "0px",
        }}
      >
        <p>{index}</p>
      </div>
      <p className="text-black">{userID + " さん"}</p>
    </div>
  );
};
