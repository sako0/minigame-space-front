import { useState, useEffect, MutableRefObject, useCallback } from "react";

type UseAreaProps = {
  areaId: number;
  fromUserID: number;
  socket: MutableRefObject<WebSocket | null>;
  connectWebSocket: () => void;
  disconnectWebSocket: () => void;
};

export const useArea = (props: UseAreaProps) => {
  const { areaId, fromUserID, socket, connectWebSocket, disconnectWebSocket } =
    props;

  const joinArea = useCallback(() => {
    connectWebSocket();
    if (socket.current) {
      socket.current.onopen = () => {
        if (!socket.current) return;
        socket.current.send(
          JSON.stringify({
            type: "join-area",
            areaId: areaId,
            fromUserID: fromUserID,
          })
        );
      };

      socket.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
    }
  }, [areaId, fromUserID, socket, connectWebSocket]);

  const leaveArea = useCallback(() => {
    if (socket.current) {
      socket.current.send(
        JSON.stringify({
          type: "leave-area",
          areaId: areaId,
          fromUserID: fromUserID,
        })
      );
      disconnectWebSocket();
    }
  }, [areaId, fromUserID, socket, disconnectWebSocket]);

  return { joinArea, leaveArea };
};
