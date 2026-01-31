import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import * as db from "./db";

// Types for socket events
interface DebateRoomState {
  sessionId: number;
  roomCode: string;
  participants: Map<string, {
    oderId: number;
    participantId: number;
    team: string;
    speakerRole: string;
    isConnected: boolean;
    isSpeaking: boolean;
  }>;
  currentSpeaker: string | null;
  speechStartTime: number | null;
  isPaused: boolean;
}

// Store active debate rooms
const debateRooms = new Map<string, DebateRoomState>();

// Store socket to room mapping
const socketToRoom = new Map<string, string>();

export function initializeSocket(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket.io",
  });

  io.on("connection", (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // Join a debate room
    socket.on("join-room", async (data: { roomCode: string; participantId: number; userId: number }) => {
      const { roomCode, participantId, userId } = data;
      
      try {
        const session = await db.getDebateSessionByRoomCode(roomCode);
        if (!session) {
          socket.emit("error", { message: "Room not found" });
          return;
        }

        const participants = await db.getSessionParticipants(session.id);
        const participant = participants.find(p => p.id === participantId);
        
        if (!participant) {
          socket.emit("error", { message: "Participant not found" });
          return;
        }

        // Initialize room state if not exists
        if (!debateRooms.has(roomCode)) {
          debateRooms.set(roomCode, {
            sessionId: session.id,
            roomCode,
            participants: new Map(),
            currentSpeaker: null,
            speechStartTime: null,
            isPaused: false,
          });
        }

        const room = debateRooms.get(roomCode)!;
        
        // Add participant to room
        room.participants.set(socket.id, {
          oderId: participant.userId,
          participantId: participant.id,
          team: participant.team,
          speakerRole: participant.speakerRole,
          isConnected: true,
          isSpeaking: false,
        });

        // Update database
        await db.updateParticipantConnection(participantId, true);

        // Join socket room
        socket.join(roomCode);
        socketToRoom.set(socket.id, roomCode);

        // Fetch fresh participant list from database
        const dbParticipants = await db.getSessionParticipants(session.id);
        
        // Notify ALL room members (including the joiner) with updated participant list
        io.to(roomCode).emit("participants-updated", {
          participants: dbParticipants,
        });

        // Send current room state to joining participant
        const roomState = {
          sessionId: session.id,
          status: session.status,
          currentSpeakerIndex: session.currentSpeakerIndex,
          participants: dbParticipants,
          currentSpeaker: room.currentSpeaker,
          speechStartTime: room.speechStartTime,
          isPaused: room.isPaused,
        };
        
        socket.emit("room-state", roomState);
        
        console.log(`[Socket] ${socket.id} joined room ${roomCode} as ${participant.speakerRole}`);
      } catch (error) {
        console.error("[Socket] Error joining room:", error);
        socket.emit("error", { message: "Failed to join room" });
      }
    });

    // Leave room
    socket.on("leave-room", async () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      await handleLeaveRoom(socket, roomCode);
    });

    // Start speaking
    socket.on("start-speaking", async (data: { speechId: number }) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = debateRooms.get(roomCode);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant) return;

      // Update room state
      room.currentSpeaker = socket.id;
      room.speechStartTime = Date.now();
      participant.isSpeaking = true;

      // Broadcast to room
      io.to(roomCode).emit("speaker-started", {
        participantId: participant.participantId,
        speakerRole: participant.speakerRole,
        team: participant.team,
        speechId: data.speechId,
        startTime: room.speechStartTime,
      });

      console.log(`[Socket] ${participant.speakerRole} started speaking in ${roomCode}`);
    });

    // Stop speaking
    socket.on("stop-speaking", async (data: { speechId: number }) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = debateRooms.get(roomCode);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant) return;

      // Calculate duration
      const duration = room.speechStartTime 
        ? Math.floor((Date.now() - room.speechStartTime) / 1000)
        : 0;

      // Update room state
      room.currentSpeaker = null;
      room.speechStartTime = null;
      participant.isSpeaking = false;

      // Broadcast to room
      io.to(roomCode).emit("speaker-stopped", {
        participantId: participant.participantId,
        speakerRole: participant.speakerRole,
        speechId: data.speechId,
        duration,
      });

      console.log(`[Socket] ${participant.speakerRole} stopped speaking in ${roomCode}`);
    });

    // Relay audio data for WebRTC
    socket.on("audio-data", (data: { audioChunk: ArrayBuffer }) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = debateRooms.get(roomCode);
      if (!room || room.currentSpeaker !== socket.id) return;

      // Broadcast audio to other participants
      socket.to(roomCode).emit("audio-stream", {
        senderId: socket.id,
        audioChunk: data.audioChunk,
      });
    });

    // Real-time transcript update
    socket.on("transcript-update", (data: { speechId: number; text: string; timestamp: number }) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      // Broadcast transcript to room
      io.to(roomCode).emit("transcript-segment", {
        speechId: data.speechId,
        text: data.text,
        timestamp: data.timestamp,
        senderId: socket.id,
      });
    });

    // POI offered
    socket.on("poi-offered", (data: { targetSpeechId: number; timestamp: number }) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = debateRooms.get(roomCode);
      if (!room) return;

      const participant = room.participants.get(socket.id);
      if (!participant) return;

      // Broadcast POI offer
      io.to(roomCode).emit("poi-offer", {
        offeredBy: participant.participantId,
        team: participant.team,
        speakerRole: participant.speakerRole,
        targetSpeechId: data.targetSpeechId,
        timestamp: data.timestamp,
      });
    });

    // POI response
    socket.on("poi-response", (data: { accepted: boolean; poiId?: number }) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      io.to(roomCode).emit("poi-result", {
        accepted: data.accepted,
        poiId: data.poiId,
      });
    });

    // Timer events
    socket.on("timer-pause", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = debateRooms.get(roomCode);
      if (room) {
        room.isPaused = true;
        io.to(roomCode).emit("timer-paused", { timestamp: Date.now() });
      }
    });

    socket.on("timer-resume", () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = debateRooms.get(roomCode);
      if (room) {
        room.isPaused = false;
        io.to(roomCode).emit("timer-resumed", { timestamp: Date.now() });
      }
    });

    // Debate control events
    socket.on("debate-start", async () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      const room = debateRooms.get(roomCode);
      if (!room) return;

      io.to(roomCode).emit("debate-started", {
        timestamp: Date.now(),
        firstSpeaker: "pm",
      });
    });

    socket.on("advance-speaker", async (data: { nextSpeaker: string }) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      io.to(roomCode).emit("speaker-advanced", {
        nextSpeaker: data.nextSpeaker,
        timestamp: Date.now(),
      });
    });

    socket.on("debate-end", async () => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      io.to(roomCode).emit("debate-ended", {
        timestamp: Date.now(),
      });
    });

    // Rule violation detected
    socket.on("rule-violation", (data: { violationType: string; description: string }) => {
      const roomCode = socketToRoom.get(socket.id);
      if (!roomCode) return;

      io.to(roomCode).emit("violation-flagged", {
        violationType: data.violationType,
        description: data.description,
        timestamp: Date.now(),
      });
    });

    // Handle disconnect
    socket.on("disconnect", async () => {
      const roomCode = socketToRoom.get(socket.id);
      if (roomCode) {
        await handleLeaveRoom(socket, roomCode);
      }
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  async function handleLeaveRoom(socket: Socket, roomCode: string) {
    const room = debateRooms.get(roomCode);
    if (!room) return;

    const participant = room.participants.get(socket.id);
    if (participant) {
      // Update database
      await db.updateParticipantConnection(participant.participantId, false);

      // Notify others
      socket.to(roomCode).emit("participant-left", {
        participantId: participant.participantId,
        speakerRole: participant.speakerRole,
      });

      // Remove from room
      room.participants.delete(socket.id);

      // If speaker was speaking, stop
      if (room.currentSpeaker === socket.id) {
        room.currentSpeaker = null;
        room.speechStartTime = null;
        socket.to(roomCode).emit("speaker-disconnected", {
          participantId: participant.participantId,
        });
      }
    }

    socket.leave(roomCode);
    socketToRoom.delete(socket.id);

    // Clean up empty rooms
    if (room.participants.size === 0) {
      debateRooms.delete(roomCode);
    }
  }

  return io;
}

export { debateRooms };
