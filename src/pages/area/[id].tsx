import { UserLocation, useArea } from "@/hooks/useArea";
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
  userLocations: UserLocation[];
};

const Area = () => {
  const router = useRouter();
  const { id } = router.query;
  const [currentUserID, setCurrentUserID] = useState<number>(0);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [userLocations, setUserLocations] = useState<UserLocation[]>([]);
  const [canClick, setCanClick] = useState(true);

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
  const { joinArea, leaveArea } = useArea({
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
        const { type, userLocations: incomingUserLocations } = data;

        if (type === "move") {
          setUserLocations((prevLocations) => {
            return incomingUserLocations.map((incomingLocation) => {
              const existingLocation = prevLocations.find(
                (location) => location.userID === incomingLocation.userID
              );

              if (
                existingLocation &&
                (existingLocation.xAxis !== incomingLocation.xAxis ||
                  existingLocation.yAxis !== incomingLocation.yAxis)
              ) {
                return incomingLocation;
              }

              return existingLocation ?? incomingLocation;
            });
          });
        } else if (type === "joined-area") {
          console.log("joined-area", data);
          setUserLocations(incomingUserLocations);
        }
        if (type === "leave-area") {
          console.log("leave-area", data);
          setUserLocations([]);
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
  }, [currentUserID, id, isJoined, joinArea, move, socket]);

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
        className="text-center cursor-pointer h-screen relative"
        onClick={(e) => {
          if (canClick) {
            move(e.clientX, e.clientY);
            setCanClick(false);
            setTimeout(() => {
              setCanClick(true);
            }, 500);
          }
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
        {userLocations.map((userLocation) => {
          return (
            <div
              key={userLocation.userID}
              className="absolute flex justify-center items-center w-10 h-10 rounded-full border bg-blue-400 transition-all duration-500 ease-linear"
              style={{
                left: `${userLocation.yAxis - 18}px`,
                top: `${userLocation.xAxis - 18}px`,
              }}
            >
              <p>{userLocation.userID}</p>
            </div>
          );
        })}
      </div>
    );
  }
};

export default Area;
