type GreenCircleProps = {
  talkingLevel: number;
};

export const GreenCircle = (props: GreenCircleProps) => {
  const { talkingLevel } = props;
  const greenIntensity = Math.floor((255 / 4) * talkingLevel);
  const textColor =
    talkingLevel > 0
      ? `rgba(0, ${greenIntensity}, 0, 1)`
      : "rgba(128, 128, 128, 0.5)";

  return (
    <div
      className="rounded-full w-6 h-6 ml-3"
      style={{
        backgroundColor: textColor,
        display: "inline-block",
        marginRight: "0.5rem",
      }}
    />
  );
};
