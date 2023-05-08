import { useState, useEffect, MutableRefObject, useCallback } from "react";

type UseAreaProps = {
  areaID: number;
  fromUserID: number;
  socket: MutableRefObject<WebSocket | null>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
};

export const useArea = (props: UseAreaProps) => {
  const { areaID, fromUserID, socket, connectWebSocket, disconnectWebSocket } =
    props;

  const joinArea = useCallback(() => {
    connectWebSocket();
    if (socket.current) {
      socket.current.onopen = () => {
        if (!socket.current) return;
        socket.current.send(
          JSON.stringify({
            type: "join-area",
            areaID: areaID,
            fromUserID: fromUserID,
          })
        );
      };

      socket.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    }
  }, [areaID, fromUserID, socket, connectWebSocket]);

  const leaveArea = useCallback(() => {
    if (socket.current) {
      socket.current.send(
        JSON.stringify({
          type: "leave-area",
          areaID: areaID,
          fromUserID: fromUserID,
        })
      );
      disconnectWebSocket();
    }
  }, [areaID, fromUserID, socket, disconnectWebSocket]);

  return { joinArea, leaveArea };
};
