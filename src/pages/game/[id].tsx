import RemoteAudio from "@/components/RemoteAudio";
import { AudioUserIcon } from "@/components/UserIcon/AudioUserIcon";
import useAudioChat from "@/hooks/useAudioChat";
import { useWebSocket } from "@/hooks/useWebSocket";
import { UserGameLocation, useGame } from "@/hooks/userGame";
import { useRouter } from "next/router";
import { useState } from "react";

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
  const [isJoined, setIsJoined] = useState(false);
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
    } else if (type === "leave-game") {
      console.log("leave-game", data);
      if (incomingUserGameLocations) {
        setUserGameLocations(
          incomingUserGameLocations.filter(
            (user) => user.userID !== data.fromUserID
          )
        );
      } else {
        setUserGameLocations((prevLocations) =>
          prevLocations.filter((user) => user.userID !== data.fromUserID)
        );
      }
    } else if (type === "disconnect-game") {
      console.log("disconnect-game", data);
      setUserGameLocations((prevLocations) =>
        prevLocations.filter((user) => user.userID !== data.fromUserID)
      );
    } else if (data.type === "pong") {
      setTimeout(() => {
        if (socket.current) {
          socket.current.send(
            JSON.stringify({
              type: "ping",
            })
          );
        }
      }, 5000);
    }
  };

  const errorHandler = (error: any) => {
    setIsJoined(false);
    leaveGame();
    leaveAudioChat();
    console.error("WebSocket error:", error);
  };

  const closeHandler = (event: any) => {
    setIsJoined(false);
    leaveGame();
    leaveAudioChat();
    console.log("close", event);
  };

  const onJoinClick = () => {
    setIsJoined(true);

    connectWebSocket();

    if (socket.current) {
      socket.current.addEventListener("open", openHandler);
      socket.current.addEventListener("message", messageHandler);
      socket.current.addEventListener("error", errorHandler);
      socket.current.addEventListener("close", closeHandler);
    }
  };

  const onLeaveClick = () => {
    if (isMuted) {
      toggleMute();
    }
    setIsJoined(false);
    leaveGame();
    leaveAudioChat();
    if (socket.current && socket.current.readyState === WebSocket.OPEN) {
      if (socket.current) {
        socket.current.removeEventListener("open", openHandler);
        socket.current.removeEventListener("message", messageHandler);
        socket.current.removeEventListener("error", errorHandler);
        socket.current.removeEventListener("close", closeHandler);
      }
    }
    disconnectWebSocket();
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

  if (isJoined) {
    return (
      <div
        className="text-center m-auto h-screen w-screen relative bg-orange-100"
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
          {remoteAudioRefs.size > 0 && (
            <button
              className="bg-blue-500 w-24 rounded-full shadow-lg m-2 p-2 absolute bottom-10 right-0 left-0 mx-auto"
              onClick={(e) => {
                e.stopPropagation();
                toggleMute();
              }}
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
          )}
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
          .map((userGameLocation, index) => {
            const stream = remoteAudioRefs.get(String(userGameLocation.userID))
              ?.stream as MediaStream;
            return (
              <div key={userGameLocation.userID}>
                <AudioUserIcon
                  userID={userGameLocation.userID}
                  index={index + 1}
                  xAxis={userGameLocation.xAxis}
                  yAxis={userGameLocation.yAxis}
                  audioContext={audioContext}
                  stream={stream}
                />
              </div>
            );
          })}
      </div>
    );
  }
};

export default Game;
