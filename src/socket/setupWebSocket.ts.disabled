import { Server } from "http";
import { WebSocket, WebSocketServer } from "ws";
import { jwtHelpers } from "../app/helper/jwtHelper";
import logger from "../utils/logger";
import { prisma } from "../utils/prisma";

interface ExtendedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface TypingUser {
  userId: string;
  roomId: string;
  timestamp: number;
}

const ONLINE_USERS_KEY = "online_users";
export const onlineUsers = new Set<string>();
export const userSockets = new Map<string, ExtendedWebSocket>();
export const typingUsers = new Map<string, TypingUser>(); // Track typing users

// Heartbeat interval for connection health check
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const TYPING_TIMEOUT = 3000; // 3 seconds

export async function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });
  logger.info("✅ WebSocket server is running");

  // Heartbeat mechanism to detect broken connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        logger.warn(`Terminating dead connection for user: ${ws.userId}`);
        if (ws.userId) {
          onlineUsers.delete(ws.userId);
          userSockets.delete(ws.userId);
          broadcastUserStatus(wss, ws.userId, false);
        }
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  wss.on("connection", (ws: ExtendedWebSocket) => {
    ws.isAlive = true;
    logger.info("New WebSocket connection established");

    // Pong response handler
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    ws.on("message", async (data: string) => {
      try {
        const parsedData = JSON.parse(data);
        logger.debug(`WebSocket event: ${parsedData.event}`, { userId: ws.userId });

        switch (parsedData.event) {
          case "authenticate": {
            const token = parsedData.token;

            if (!token) {
              ws.close();
              return ws.send(
                JSON.stringify({
                  event: "authorization",
                  success: false,
                  message: "Token is required for authentication!",
                })
              );
            }

            const user = jwtHelpers.verifyToken(token);

            if (!user) {
              ws.close();
              return ws.send(
                JSON.stringify({
                  event: "authorization",
                  success: false,
                  message: "Invalid token or user not found!",
                })
              );
            }

            const { id } = user;

            ws.userId = id;
            onlineUsers.add(id);
            userSockets.set(id, ws);

            // Broadcast that user is online
            broadcastUserStatus(wss, id, true);

            // Send success response
            ws.send(
              JSON.stringify({
                event: "authenticated",
                success: true,
                userId: id,
              })
            );

            logger.info(`User authenticated: ${id}`);
            break;
          }

          case "sendMessage": {
            const { receiverId, message, images } = parsedData;

            console.log("ws.userId ", ws.userId);
            if (!ws.userId || !receiverId || !message) {
              console.log("Invalid message payload");
              return;
            }

            let room = await prisma.room.findFirst({
              where: {
                OR: [
                  { senderId: ws.userId, receiverId },
                  { senderId: receiverId, receiverId: ws.userId },
                ],
              },
            });

            if (!room) {
              room = await prisma.room.create({
                data: { senderId: ws.userId, receiverId },
              });
            }

            const chat = await prisma.chat.create({
              data: {
                senderId: ws.userId,
                receiverId,
                roomId: room.id,
                message,
                images: { set: images || [] },
              },
            });

            const receiverSocket = userSockets.get(receiverId);
            if (receiverSocket) {
              receiverSocket.send(
                JSON.stringify({ event: "message", data: chat })
              );
            }
            ws.send(JSON.stringify({ event: "message", data: chat }));
            break;
          }

          case "project": {
            ws.send(JSON.stringify({ parsedData }));
            return;
          }

          case "fetchChats": {
            const { receiverId, page, limit } = parsedData;
            if (!ws.userId) {
              console.log("User not authenticated");
              return;
            }

            const room = await prisma.room.findFirst({
              where: {
                OR: [
                  { senderId: ws.userId, receiverId },
                  { senderId: receiverId, receiverId: ws.userId },
                ],
              },
            });

            if (!room) {
              ws.send(JSON.stringify({ event: "fetchChats", data: [] }));
              return;
            }

            const chats = await prisma.chat.findMany({
              where: { roomId: room.id },
              orderBy: { createdAt: "asc" },
              skip: (page - 1) * limit,
              take: limit,
            });

            await prisma.chat.updateMany({
              where: { roomId: room.id, receiverId: ws.userId },
              data: { isRead: true },
            });

            ws.send(
              JSON.stringify({
                event: "fetchChats",
                data: chats,
              })
            );
            break;
          }
          case "onlineUsers": {
            const onlineUserList = Array.from(onlineUsers);
            const user = await prisma.user.findMany({
              where: { id: { in: onlineUserList } },
              select: {
                id: true,
                email: true,
                role: true,
              },
            });
            ws.send(
              JSON.stringify({
                event: "onlineUsers",
                data: user,
              })
            );
            break;
          }

          case "unReadMessages": {
            const { receiverId } = parsedData;
            if (!ws.userId || !receiverId) {
              console.log("Invalid unread messages payload");
              return;
            }

            const room = await prisma.room.findFirst({
              where: {
                OR: [
                  { senderId: ws.userId, receiverId },
                  { senderId: receiverId, receiverId: ws.userId },
                ],
              },
            });

            if (!room) {
              ws.send(JSON.stringify({ event: "noUnreadMessages", data: [] }));
              return;
            }

            const unReadMessages = await prisma.chat.findMany({
              where: { roomId: room.id, isRead: false, receiverId: ws.userId },
            });

            const unReadCount = unReadMessages.length;

            ws.send(
              JSON.stringify({
                event: "unReadMessages",
                data: { messages: unReadMessages, count: unReadCount },
              })
            );
            break;
          }

          case "messageList": {
            try {
              // Fetch all rooms where the user is involved
              const rooms = await prisma.room.findMany({
                where: {
                  OR: [{ senderId: ws.userId }, { receiverId: ws.userId }],
                },
                include: {
                  chat: {
                    orderBy: {
                      createdAt: "desc",
                    },
                    take: 1, // Fetch only the latest message for each room
                  },
                },
              });

              // Extract the relevant user IDs from the rooms
              const userIds: string[] = (rooms as RoomWithChat[]).map((room: RoomWithChat): string => {
                return room.senderId === ws.userId ? room.receiverId : room.senderId;
              });

              // Fetch user profiles for the corresponding user IDs
              const userInfos = await prisma.user.findMany({
                where: {
                  id: {
                    in: userIds,
                  },
                },
              });

              // Combine user info with their last message
                interface ChatMessage {
                id: string;
                senderId: string;
                receiverId: string;
                roomId: string;
                message: string | null;
                images: string[] | null;
                createdAt: Date;
                isRead?: boolean;
                [key: string]: any;
                }

                interface RoomWithChat {
                id: string;
                senderId: string;
                receiverId: string;
                chat: ChatMessage[];
                [key: string]: any;
                }

                interface UserInfo {
                id: string;
                email?: string | null;
                role?: string | null;
                [key: string]: any;
                }

                interface UserWithLastMessage {
                user: UserInfo | null;
                lastMessage: ChatMessage | null;
                }

                const userWithLastMessages: UserWithLastMessage[] = rooms.map(
                (room: RoomWithChat) => {
                  const otherUserId: string | undefined =
                  room.senderId === ws.userId ? room.receiverId : room.senderId;
                  const userInfo: UserInfo | undefined = otherUserId
                    ? userInfos.find((u: UserInfo) => u.id === otherUserId)
                    : undefined;

                  return {
                  user: userInfo || null,
                  lastMessage: room.chat[0] || null,
                  };
                }
                );

              // Send the result back to the requesting client
              ws.send(
                JSON.stringify({
                  event: "messageList",
                  data: userWithLastMessages,
                })
              );
            } catch (error) {
              console.error(
                "Error fetching user list with last messages:",
                error
              );
              ws.send(
                JSON.stringify({
                  event: "error",
                  message: "Failed to fetch users with last messages",
                })
              );
            }
            break;
          }

          case "typing": {
            const { receiverId, roomId, isTyping } = parsedData;
            if (!ws.userId || !receiverId) {
              return;
            }

            if (isTyping) {
              typingUsers.set(`${ws.userId}-${roomId}`, {
                userId: ws.userId,
                roomId,
                timestamp: Date.now(),
              });
            } else {
              typingUsers.delete(`${ws.userId}-${roomId}`);
            }

            // Send typing indicator to receiver
            const receiverSocket = userSockets.get(receiverId);
            if (receiverSocket) {
              receiverSocket.send(
                JSON.stringify({
                  event: "typingStatus",
                  data: {
                    userId: ws.userId,
                    roomId,
                    isTyping,
                  },
                })
              );
            }
            break;
          }

          case "getOnlineStatus": {
            const { userIds } = parsedData;
            if (!Array.isArray(userIds)) {
              return;
            }

            const onlineStatus = userIds.map((userId: string) => ({
              userId,
              isOnline: onlineUsers.has(userId),
            }));

            ws.send(
              JSON.stringify({
                event: "onlineStatus",
                data: onlineStatus,
              })
            );
            break;
          }

          default:
            logger.warn("Unknown event type:", parsedData.event);
        }
      } catch (error) {
        logger.error("Error handling WebSocket message:", error);
        ws.send(
          JSON.stringify({
            event: "error",
            message: "Failed to process message",
          })
        );
      }
    });

    ws.on("close", () => {
      if (ws.userId) {
        onlineUsers.delete(ws.userId);
        userSockets.delete(ws.userId);

        // Remove from typing users
        typingUsers.forEach((value, key) => {
          if (value.userId === ws.userId) {
            typingUsers.delete(key);
          }
        });

        broadcastUserStatus(wss, ws.userId, false);
        logger.info(`User disconnected: ${ws.userId}`);
      }
    });

    ws.on("error", (error) => {
      logger.error("WebSocket error:", error);
    });
  });

  // Clean up old typing indicators
  setInterval(() => {
    const now = Date.now();
    typingUsers.forEach((value, key) => {
      if (now - value.timestamp > TYPING_TIMEOUT) {
        typingUsers.delete(key);
      }
    });
  }, 1000);

  return wss;
}

// Broadcast user online/offline status
function broadcastUserStatus(
  wss: WebSocketServer,
  userId: string,
  isOnline: boolean
) {
  broadcastToAll(wss, {
    event: "userStatus",
    data: { userId, isOnline, timestamp: Date.now() },
  });
}

function broadcastToAll(wss: WebSocketServer, message: object) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Send message to specific user
export function sendToUser(userId: string, message: object) {
  const socket = userSockets.get(userId);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  return false;
}

// Get online users count
export function getOnlineUsersCount(): number {
  return onlineUsers.size;
}

// Check if user is online
export function isUserOnline(userId: string): boolean {
  return onlineUsers.has(userId);
}
