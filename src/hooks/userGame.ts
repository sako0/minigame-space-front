import { MutableRefObject, useCallback, useEffect, useState } from "react";

type UseGameProps = {
  roomID: number;
  currentUserID: number;
  socket: MutableRefObject<WebSocket | null>;
};

export type UserGameLocation = {
  userID: number;
  xAxis: number;
  yAxis: number;
  roomID: number;
};

export const useGame = (props: UseGameProps) => {
  const { roomID, currentUserID, socket } = props;
  const joinGame = useCallback(() => {
    if (socket.current) {
      socket.current.send(
        JSON.stringify({
          type: "join-game",
          roomID: roomID,
          fromUserID: currentUserID,
        })
      );
    }
  }, [roomID, currentUserID, socket]);

  const leaveGame = useCallback(() => {
    if (socket.current) {
      socket.current.send(
        JSON.stringify({
          type: "leave-game",
          roomID: roomID,
          fromUserID: currentUserID,
        })
      );
    }
  }, [currentUserID, roomID, socket]);

  const move = useCallback(
    (xAxis: number, yAxis: number) => {
      if (socket.current) {
        const clientWidth = document.documentElement.clientWidth;
        const xAxisPercentage = (xAxis / clientWidth) * 100;
        const xAxisNumber = Math.floor(xAxisPercentage);

        const clientHeight = document.documentElement.clientHeight;
        const yAxisPercentage = (yAxis / clientHeight) * 100;
        const yAxisNumber = Math.floor(yAxisPercentage);

        socket.current.send(
          JSON.stringify({
            type: "move",
            roomID: roomID,
            fromUserID: currentUserID,
            xAxis: xAxisNumber,
            yAxis: yAxisNumber,
          })
        );
      }
    },
    [currentUserID, roomID, socket]
  );

  return { joinGame, leaveGame, move };
};
