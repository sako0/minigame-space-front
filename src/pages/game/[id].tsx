import RemoteAudio from "@/components/RemoteAudio";
import useAudioChat from "@/hooks/useAudioChat";
import { useWebSocket } from "@/hooks/useWebSocket";
import { UserGameLocation, useGame } from "@/hooks/userGame";
import { useRouter } from "next/router";
import { useRef, useState } from "react";

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
  const [userGameLocations, setUserGameLocations] = useState<
    UserGameLocation[]
  >([]);
  const [canClick, setCanClick] = useState(true);
  const [socketState, setSocketState] = useState<WebSocket | null>(null);
  const isHandlerAdded = useRef(false);
  const url =
    process.env.NODE_ENV === "production"
      ? `wss://api.mini-game-space.link/game`
      : `ws://localhost:5500/game`;
  const { socket, connectWebSocket, disconnectWebSocket } = useWebSocket(url);

  const { joinGame, leaveGame, move } = useGame({
    roomID: Number(id),
    currentUserID: currentUserID ?? 0,
    socket,
  });

  const {
    localAudioRef,
    remoteAudioRefs,
    handleVolumeChange,
    joinAudioChat,
    leaveAudioChat,
    toggleMute,
    isMuted,
    audioContext,
  } = useAudioChat({
    roomID: Number(id),
    currentUserUid: currentUserID ?? 0,
    socket,
    connectWebSocket,
    disconnectWebSocket,
  });

  const openHandler = () => {
    joinGame();
    joinAudioChat();
  };

  const messageHandler = (event: MessageEvent) => {
    if (!event.data) return;
    const data: Message = JSON.parse(event.data);
    const { type, userGameLocations: incomingUserGameLocations } = data;
    console.log("incomingUserGameLocations", incomingUserGameLocations);

    if (type === "move") {
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
    } else if (type === "join-game") {
      console.log("join-game", data);

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

  const errorHandler = (error: any) => {
    console.error("WebSocket error:", error);
  };

  const closeHandler = (event: any) => {
    leaveAudioChat();
    console.log("close", event);
  };

  const onJoinClick = () => {
    if (!socketState || socketState.readyState !== WebSocket.OPEN) {
      connectWebSocket();
    }

    setSocketState(socket.current);
    if (socket.current && !isHandlerAdded.current) {
      socket.current.addEventListener("open", openHandler);
      socket.current.addEventListener("message", messageHandler);
      socket.current.addEventListener("error", errorHandler);
      socket.current.addEventListener("close", closeHandler);
      isHandlerAdded.current = true;
    }
  };

  const onLeaveClick = () => {
    if (socketState && socketState.readyState === WebSocket.OPEN) {
      if (socket.current && isHandlerAdded.current) {
        socket.current.removeEventListener("open", openHandler);
        socket.current.removeEventListener("message", messageHandler);
        socket.current.removeEventListener("error", errorHandler);
        socket.current.removeEventListener("close", closeHandler);
        isHandlerAdded.current = false;
      }
      leaveGame();
      socketState.close();
    }
  };

  if (!socketState || socketState.readyState !== WebSocket.OPEN) {
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

  if (socketState && socketState.readyState === WebSocket.OPEN) {
    return (
      <div
        className="text-center cursor-pointer m-auto h-screen w-screen relative bg-orange-100"
        onClick={(e) => {
          if (
            canClick &&
            socket.current &&
            socket.current.readyState === WebSocket.OPEN
          ) {
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
        <div className="mt-10">
          <audio ref={localAudioRef} autoPlay playsInline muted />
          {Array.from(remoteAudioRefs).map(([streamId, remoteAudioRef]) => (
            <RemoteAudio
              key={streamId}
              userId={streamId}
              stream={remoteAudioRef.stream}
              volume={remoteAudioRef.volume}
              onVolumeChange={handleVolumeChange}
              audioContext={audioContext}
            />
          ))}
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
