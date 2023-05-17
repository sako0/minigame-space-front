import { useArea } from "@/hooks/useArea";
import { useMove } from "@/hooks/useMove";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";

export type Message = {
  type: string;
  fromUserID: number;
  toUserID: number;
  roomID: number;
  connectedUserIds: number[];
  xAxis: number;
  yAxis: number;
};

const Area = () => {
  const router = useRouter();
  const { id } = router.query;
  const [currentUserID, setCurrentUserID] = useState<number>(0);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [xAxis, setXAxis] = useState(0);
  const [yAxis, setYAxis] = useState(0);

  const url =
    process.env.NODE_ENV === "production"
      ? `wss://api.mini-game-space.link/ws`
      : `ws://192.168.11.6:5500/ws`;
  const { socket, connectWebSocket } = useWebSocket(url);
  const isWebSocketOpen = useRef(false);

  const { move } = useMove({
    socket,
    areaID: Number(id),
    currentUserID: currentUserID ?? 0,
  });
  const { joinArea, connectedUsers, setConnectedUsers, leaveArea } = useArea({
    areaID: Number(id),
    currentUserID: currentUserID ?? 0,
    socket,
  });

  useEffect(() => {
    const currentSocket = socket.current;
    if (currentSocket) {
      currentSocket.onopen = () => {
        isWebSocketOpen.current = true;
        if (isJoined && currentUserID) {
          joinArea();
        }
      };
      currentSocket.onmessage = (event) => {
        const data: Message = JSON.parse(event.data);
        const { type, fromUserID, toUserID, xAxis, yAxis } = data;
        if (type === "move") {
          console.log("move", data);
        } else if (type === "joined-area") {
          console.log("joined-area", data);
          if (fromUserID === currentUserID) return;

          const newConnectedUser = {
            userID: fromUserID,
            xAxis: xAxis,
            yAxis: yAxis,
          };
          setConnectedUsers((prevUsers) => [...prevUsers, newConnectedUser]);
        }
        if (type === "leave-area") {
          console.log("leave-area", data);
          setConnectedUsers((prevUsers) =>
            prevUsers.filter((user) => user.userID !== fromUserID)
          );
        }
      };
      currentSocket.onerror = (error) => {
        console.error("WebSocket error:", error);
      };
      currentSocket.onclose = () => {
        isWebSocketOpen.current = false;
      };
    }
    return () => {
      if (isWebSocketOpen.current && currentSocket) {
        currentSocket.close();
      }
    };
  }, [currentUserID, id, isJoined, joinArea, move, setConnectedUsers, socket]);

  const onJoinClick = () => {
    if (!isWebSocketOpen.current) {
      connectWebSocket();
    }
    setIsJoined(true);
  };

  const onLeaveClick = () => {
    if (isWebSocketOpen.current) {
      leaveArea();
    }
    setIsJoined(false);
  };
  if (!isJoined) {
    return (
      <div className="text-center">
        <div>
          <input
            className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black"
            placeholder="ユーザーID"
            type="text"
            value={currentUserID === 0 ? "" : String(currentUserID)}
            onChange={(e) => setCurrentUserID(Number(e.target.value))}
          />

          <button
            className="bg-lime-500 rounded-md shadow-lg m-2 p-2"
            onClick={onJoinClick}
          >
            Join Area
          </button>
        </div>
      </div>
    );
  }
  if (socket.current) {
    return (
      <div
        className="text-center cursor-pointer h-screen"
        onClick={(e) => {
          move(e.clientX, e.clientY);
        }}
      >
        <div>
          <p className="text-black">ユーザーID: {currentUserID}</p>
          <div>
            <button
              className="bg-red-500 rounded-md shadow-lg m-2 p-2"
              onClick={(e) => {
                e.stopPropagation();
                onLeaveClick();
              }}
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    );
  }
};

export default Area;
