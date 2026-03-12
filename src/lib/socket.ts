import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = () => {
    if (!socket && typeof window !== "undefined") {
        socket = io();
    }
    return socket;
};

export const joinGroup = (groupId: string) => {
    const s = getSocket();
    if (s) s.emit("join-group", groupId);
};

export const joinSection = (sectionId: string) => {
    const s = getSocket();
    if (s) s.emit("join-section", sectionId);
};

export const joinUser = (userId: string) => {
    const s = getSocket();
    if (s) s.emit("join-user", userId);
};
