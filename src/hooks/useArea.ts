import { MutableRefObject, useCallback, useEffect, useState } from "react";

type UseAreaProps = {
  areaID: number;
  currentUserID: number;
  socket: MutableRefObject<WebSocket | null>;
};

type UserInfo = {
  userID: number;
  xAxis: number;
  yAxis: number;
};

export const useArea = (props: UseAreaProps) => {
  const [connectedUsers, setConnectedUsers] = useState<UserInfo[]>([]);
  const { areaID, currentUserID, socket } = props;
  const joinArea = useCallback(() => {
    if (socket.current) {
      socket.current.send(
        JSON.stringify({
          type: "join-area",
          areaID: areaID,
          fromUserID: currentUserID,
        })
      );
    }
  }, [areaID, currentUserID, socket]);

  const leaveArea = useCallback(() => {
    if (socket.current) {
      socket.current.send(
        JSON.stringify({
          type: "leave-area",
          areaID: areaID,
          fromUserID: currentUserID,
        })
      );
    }
  }, [areaID, currentUserID, socket]);

  return { joinArea, connectedUsers, setConnectedUsers, leaveArea };
};
