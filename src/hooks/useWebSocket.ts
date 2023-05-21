import { useEffect, useRef } from "react";

export const useWebSocket = (url: string) => {
  const socket = useRef<WebSocket | null>(null);
  const handlers = useRef<{ [type: string]: ((data?: any) => void)[] }>({});

  const addHandler = (type: string, handler: (data?: any) => void) => {
    if (!handlers.current[type]) {
      handlers.current[type] = [];
    }
    handlers.current[type].push(handler);
  };

  const removeHandler = (type: string, handler: (data?: any) => void) => {
    if (handlers.current[type]) {
      handlers.current[type] = handlers.current[type].filter(
        (h) => h !== handler
      );
    }
  };

  const connectWebSocket = () => {
    if (socket.current && socket.current.readyState === WebSocket.OPEN) return;
    socket.current = new WebSocket(url);

    socket.current.onopen = (event) => {
      handlers.current["open"]?.forEach((handler) => handler(event));
    };

    socket.current.onmessage = (event) => {
      handlers.current["message"]?.forEach((handler) => handler(event));
    };

    socket.current.onerror = (event) => {
      handlers.current["error"]?.forEach((handler) => handler(event));
    };

    socket.current.onclose = (event) => {
      handlers.current["close"]?.forEach((handler) => handler(event));
      // Automatically reconnect if the connection is closed.
      connectWebSocket();
    };
  };

  const disconnectWebSocket = () => {
    if (socket.current) {
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
    addHandler,
    removeHandler,
  };
};
