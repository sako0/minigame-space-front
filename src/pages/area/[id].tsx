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

  return (
    <div className="text-center">
      <div>
        {!isJoined ? (
          <input
            className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black"
            placeholder="ユーザーID"
            type="text"
            value={currentUserID === 0 ? "" : String(currentUserID)}
            onChange={(e) => setCurrentUserID(Number(e.target.value))}
          />
        ) : (
          <p className="text-black">ユーザーID: {currentUserID}</p>
        )}

        {!isJoined && (
          <button
            className="bg-lime-500 rounded-md shadow-lg m-2 p-2"
            onClick={onJoinClick}
          >
            Join Area
          </button>
        )}
        {isJoined && (
          <button
            className="bg-red-500 rounded-md shadow-lg m-2 p-2"
            onClick={onLeaveClick}
          >
            Leave Area
          </button>
        )}
        {isJoined && socket.current && (
          <>
            <div className="flex justify-center">
              <p className="text-black">xAxis: {xAxis}</p>
              <input
                type="text"
                className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black"
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setXAxis(value);
                }}
              />
            </div>
            <div className="flex justify-center">
              <p className="text-black">yAxis: {yAxis}</p>
              <input
                type="text"
                className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black"
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setYAxis(value);
                }}
              />
            </div>
            <button
              className="bg-blue-500 rounded-md shadow-lg m-2 p-2"
              onClick={() => {
                move(xAxis, yAxis);
              }}
            >
              Move
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Area;
