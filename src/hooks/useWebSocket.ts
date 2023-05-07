import { useRef } from "react";

export const useWebSocket = (url: string) => {
  const socket = useRef<WebSocket | null>(null);

  const connectWebSocket = () => {
    socket.current = new WebSocket(url);
  };
  const disconnectWebSocket = () => {
    if (socket.current) {
      // WebSocketのイベントリスナーを削除
      socket.current.onmessage = null;
      socket.current.onopen = null;
      socket.current.onerror = null;
      socket.current.onclose = null;
      // WebSocket接続を閉じる
      socket.current.close();
      socket.current = null;
    }
  };

  return { socket, connectWebSocket, disconnectWebSocket };
};
