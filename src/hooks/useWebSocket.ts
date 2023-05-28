import { useEffect, useRef } from "react";

export const useWebSocket = (url: string) => {
  const socket = useRef<WebSocket | null>(null);

  const connectWebSocket = () => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) return;
    socket.current = new WebSocket(url);
  };

  const disconnectWebSocket = () => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      socket.current.onmessage = null;
      socket.current.onopen = null;
      socket.current.onerror = null;
      socket.current.onclose = null;
      socket.current.close();
      socket.current = null;
    }
  };

  if (socket.current) {
    socket.current.addEventListener("open", (event) => {
      console.log("WebSocket接続確立", event);
      if (!socket.current) return;
      socket.current.send(
        JSON.stringify({
          type: "ping",
        })
      );
    });
  }

  return {
    socket,
    connectWebSocket,
    disconnectWebSocket,
  };
};
