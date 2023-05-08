import { useArea } from "@/hooks/useArea";
import { useMove } from "@/hooks/useMove";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const Area = () => {
  const router = useRouter();
  const { id } = router.query;
  const [userId, setUserId] = useState<number>(0);
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const url =
    process.env.NODE_ENV === "production"
      ? `wss://api.mini-game-space.link/signaling`
      : `ws://192.168.11.6:5500/signaling`;
  const { socket, connectWebSocket, disconnectWebSocket } = useWebSocket(url);

  const { joinArea, leaveArea } = useArea({
    areaID: Number(id),
    fromUserID: userId ?? 0,
    socket,
    connectWebSocket,
    disconnectWebSocket,
  });

  const { move, xAxis, yAxis, setXAxis, setYAxis } = useMove({
    areaID: Number(id),
    fromUserID: userId ?? 0,
    socket,
    connectWebSocket,
  });

  // useEffect(() => {
  //   if (isJoined) {
  //     move();
  //   }
  // }, [isJoined, move]);

  return (
    <div className="text-center">
      <div>
        {!isJoined ? (
          <input
            className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black"
            placeholder="ユーザーID"
            type="text"
            value={userId === 0 ? "" : String(userId)}
            onChange={(e) => setUserId(Number(e.target.value))}
          />
        ) : (
          <p className="text-black">ユーザーID: {userId}</p>
        )}

        {!isJoined && (
          <button
            className="bg-lime-500 rounded-md shadow-lg m-2 p-2"
            onClick={() => {
              joinArea();
              setIsJoined(true);
            }}
          >
            Join Area
          </button>
        )}
        {isJoined && (
          <button
            className="bg-red-500 rounded-md shadow-lg m-2 p-2"
            onClick={() => {
              leaveArea();
              setIsJoined(false);
            }}
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
                value={xAxis}
                onChange={(e) => {
                  setXAxis(Number(e.target.value));
                }}
              />
            </div>
            <div className="flex justify-center">
              <p className="text-black">yAxis: {yAxis}</p>
              <input
                type="text"
                className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black"
                value={yAxis}
                onChange={(e) => {
                  setYAxis(Number(e.target.value));
                }}
              />
            </div>
            <button
              className="bg-green-500 rounded-md shadow-lg m-2 p-2"
              onClick={() => {
                move();
              }}
            >
              Move用のwebsocket
            </button>
            <button
              className="bg-blue-500 rounded-md shadow-lg m-2 p-2"
              onClick={() => {
                if (socket.current) {
                  socket.current.send(
                    JSON.stringify({
                      type: "move",
                      areaID: Number(id),
                      fromUserID: userId,
                      xAxis: xAxis,
                      yAxis: yAxis,
                    })
                  );
                }
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
