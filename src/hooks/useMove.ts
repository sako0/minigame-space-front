import { MutableRefObject, useCallback } from "react";

type UseMoveProps = {
  socket: MutableRefObject<WebSocket | null>;
  areaID: number;
  currentUserID: number;
};
export const useMove = (props: UseMoveProps) => {
  const { socket, areaID, currentUserID } = props;

  const move = useCallback(
    (xAxis: number, yAxis: number) => {
      if (socket.current) {
        const clientWidth = document.documentElement.clientWidth;
        const xAxisPercentage = (xAxis / clientWidth) * 100;
        const xAxisNumber = Math.floor(xAxisPercentage);

        const clientHeight = document.documentElement.clientHeight;
        const yAxisPercentage = (yAxis / clientHeight) * 100;
        const yAxisNumber = Math.floor(yAxisPercentage);

        socket.current.send(
          JSON.stringify({
            type: "move",
            areaID: areaID,
            fromUserID: currentUserID,
            xAxis: xAxisNumber,
            yAxis: yAxisNumber,
          })
        );
      }
    },
    [areaID, currentUserID, socket]
  );

  return { move };
};
