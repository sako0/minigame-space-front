import { useState, useEffect, MutableRefObject, useCallback } from "react";

type UseMoveProps = {
  areaID: number;
  fromUserID: number;
  socket: MutableRefObject<WebSocket | null>;
  connectWebSocket: () => void;
};

type Message = {
  type: string;
  fromUserID: number;
  toUserID: number;
  roomID: number;
  connectedUserIds: number[];
  xAxis: number;
  yAxis: number;
};

export const useMove = (props: UseMoveProps) => {
  const { areaID, fromUserID, socket, connectWebSocket } = props;
  const [xAxis, setXAxis] = useState(0);
  const [yAxis, setYAxis] = useState(0);

  const move = useCallback(() => {
    connectWebSocket();
    if (socket.current) {
      socket.current.onopen = () => {
        if (!socket.current) return;
        socket.current.send(
          JSON.stringify({
            type: "move",
            areaID: areaID,
            fromUserID: fromUserID,
            xAxis: xAxis,
            yAxis: yAxis,
          })
        );
      };
      socket.current.onmessage = (event) => {
        const data: Message = JSON.parse(event.data);
        const { type, fromUserID, toUserID, xAxis, yAxis } = data;
        if (type === "move") {
          console.log("move", data);
        }
      };
      socket.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    }
  }, [connectWebSocket, socket, areaID, fromUserID, xAxis, yAxis]);

  return { move, xAxis, yAxis, setXAxis, setYAxis };
};
