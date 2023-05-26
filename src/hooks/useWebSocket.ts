import { useRef } from "react";

export const useWebSocket = (url: string) => {
  const socket = useRef<WebSocket | null>(null);
  const handlers = useRef<{ [type: string]: ((data?: any) => void)[] }>({});

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

  return {
    socket,
    connectWebSocket,
    disconnectWebSocket,
  };
};
