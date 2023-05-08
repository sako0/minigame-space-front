import { useArea } from "@/hooks/useArea";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useRouter } from "next/router";
import { useState } from "react";

const Area = () => {
  const router = useRouter();
  const { id } = router.query;
  const [userId, setUserId] = useState<number>(0);
  const url =
    process.env.NODE_ENV === "production"
      ? `wss://api.mini-game-space.link/signaling`
      : `ws://192.168.11.6:5500/signaling`;
  const { socket, connectWebSocket, disconnectWebSocket } = useWebSocket(url);

  const { joinArea, leaveArea } = useArea({
    areaId: Number(id),
    fromUserID: userId ?? 0,
    socket,
    connectWebSocket,
    disconnectWebSocket,
  });

  return (
    <div className="text-center">
      <div>
        <input
          className="bg-gray-200 rounded-md shadow-lg m-2 p-2 text-black"
          placeholder="ユーザーID"
          type="text"
          value={userId === 0 ? "" : String(userId)}
          onChange={(e) => setUserId(Number(e.target.value))}
        />
        <button
          className="bg-lime-500 rounded-md shadow-lg m-2 p-2"
          onClick={() => {
            joinArea();
          }}
        >
          Join Area
        </button>
        <button
          className="bg-red-500 rounded-md shadow-lg m-2 p-2"
          onClick={() => {
            leaveArea();
          }}
        >
          Leave Area
        </button>
      </div>
    </div>
  );
};

export default Area;
