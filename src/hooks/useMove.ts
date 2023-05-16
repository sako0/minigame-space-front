import { useState, MutableRefObject, useCallback } from "react";

type UseMoveProps = {
  socket: MutableRefObject<WebSocket | null>;
  areaID: number;
  currentUserID: number;
};

export const useMove = (props: UseMoveProps) => {
  const { socket, areaID, currentUserID } = props;
  const [xAxis, setXAxis] = useState(0);
  const [yAxis, setYAxis] = useState(0);

  const move = useCallback(() => {
    if (socket.current) {
      socket.current.send(
        JSON.stringify({
          type: "move",
          areaID: areaID,
          fromUserID: currentUserID,
          xAxis: xAxis,
          yAxis: yAxis,
        })
      );
    }
  }, [areaID, currentUserID, socket, xAxis, yAxis]);

  return { move, xAxis, yAxis, setXAxis, setYAxis };
};
