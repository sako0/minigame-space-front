import { MutableRefObject, useCallback } from "react";

type UseMoveProps = {
  socket: MutableRefObject<WebSocket | null>;
  areaID: number;
  currentUserID: number;
};
export const useMove = (props: UseMoveProps) => {
  const { socket, areaID, currentUserID } = props;

  const move = useCallback(
    (yAxis: number, xAxis: number) => {
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
    },
    [areaID, currentUserID, socket]
  );

  return { move };
};
