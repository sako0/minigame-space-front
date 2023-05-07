import { useState, useEffect, useRef } from "react";

export const useWebSocket = (url: string) => {
  const socket = useRef<WebSocket | null>(null);

  const connectWebSocket = () => {
    socket.current = new WebSocket(url);
  };

  return { socket, connectWebSocket };
};
