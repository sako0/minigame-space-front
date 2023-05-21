import { useWebSocket } from "@/hooks/useWebSocket";
import { UserGameLocation, useGame } from "@/hooks/userGame";
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
  userGameLocations: UserGameLocation[];
};

const Game = () => {
  const router = useRouter();
  const { id } = router.query;
  const [currentUserID, setCurrentUserID] = useState<number>(0);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [userGameLocations, setUserGameLocations] = useState<
    UserGameLocation[]
  >([]);
  const [canClick, setCanClick] = useState(true);

  const url =
    process.env.NODE_ENV === "production"
      ? `wss://api.mini-game-space.link/game`
      : `ws://192.168.11.6:5500/game`;
  const { socket, connectWebSocket } = useWebSocket(url);
  const isWebSocketOpen = useRef(false);

  const { joinGame, leaveGame, move } = useGame({
    roomID: Number(id),
    currentUserID: currentUserID ?? 0,
    socket,
  });

  useEffect(() => {
    const currentSocket = socket.current;
    if (currentSocket) {
      currentSocket.onopen = () => {
        isWebSocketOpen.current = true;
        if (isJoined && currentUserID) {
          joinGame();
        }
      };
      currentSocket.onmessage = (event) => {
        const data: Message = JSON.parse(event.data);
        const { type, userGameLocations: incomingUserGameLocations } = data;

        if (type === "move") {
          console.log("userGameLocations:", incomingUserGameLocations);
          setUserGameLocations((prevLocations) => {
            return incomingUserGameLocations.map((incomingLocation) => {
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
        } else if (type === "client-joined") {
          console.log("client-joined", data);
          setUserGameLocations(incomingUserGameLocations);
        }
        if (type === "leave-game") {
          console.log("leave-game", data);
          setUserGameLocations(
            incomingUserGameLocations.filter(
              (user) => user.userID !== data.fromUserID
            )
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
  }, [currentUserID, id, isJoined, joinGame, move, socket]);

  const onJoinClick = () => {
    if (!isWebSocketOpen.current) {
      connectWebSocket();
    }
    setIsJoined(true);
  };

  const onLeaveClick = () => {
    if (isWebSocketOpen.current) {
      leaveGame();
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
        className="text-center cursor-pointer m-auto h-screen w-screen relative bg-orange-100"
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
        {userGameLocations
          .sort((a, b) => a.userID - b.userID)
          .map((userGameLocation) => {
            return (
              <div
                key={userGameLocation.userID}
                className="absolute flex justify-center items-center w-10 h-10 rounded-full border bg-blue-400 transition-all duration-500 ease-linear"
                style={{
                  left: `calc(${userGameLocation.xAxis}% - 16px)`,
                  top: `calc(${userGameLocation.yAxis}% - 16px)`,
                  transition: "top 0.5s, left 0.5s",
                }}
              >
                <p>{userGameLocation.userID}</p>
              </div>
            );
          })}
      </div>
    );
  }
};

export default Game;
