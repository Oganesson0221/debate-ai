import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface UseSocketOptions {
  roomCode?: string;
  participantId?: number;
  userId?: number;
  onParticipantJoined?: (data: any) => void;
  onParticipantLeft?: (data: any) => void;
  onSpeakerStarted?: (data: any) => void;
  onSpeakerStopped?: (data: any) => void;
  onTranscriptSegment?: (data: any) => void;
  onPoiOffer?: (data: any) => void;
  onPoiResult?: (data: any) => void;
  onTimerPaused?: (data: any) => void;
  onTimerResumed?: (data: any) => void;
  onDebateStarted?: (data: any) => void;
  onDebateEnded?: (data: any) => void;
  onSpeakerAdvanced?: (data: any) => void;
  onViolationFlagged?: (data: any) => void;
  onRoomState?: (data: any) => void;
  onAudioStream?: (data: any) => void;
  onParticipantsUpdated?: (data: any) => void;
  onError?: (data: any) => void;
}

export function useSocket(options: UseSocketOptions) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create socket connection
    const socket = io({
      path: "/api/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[Socket] Connected:", socket.id);
      setIsConnected(true);
      setError(null);

      // Join room if provided
      if (options.roomCode && options.participantId && options.userId) {
        socket.emit("join-room", {
          roomCode: options.roomCode,
          participantId: options.participantId,
          userId: options.userId,
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("[Socket] Disconnected");
      setIsConnected(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[Socket] Connection error:", err);
      setError(err.message);
    });

    // Event handlers
    if (options.onParticipantJoined) {
      socket.on("participant-joined", options.onParticipantJoined);
    }
    if (options.onParticipantLeft) {
      socket.on("participant-left", options.onParticipantLeft);
    }
    if (options.onSpeakerStarted) {
      socket.on("speaker-started", options.onSpeakerStarted);
    }
    if (options.onSpeakerStopped) {
      socket.on("speaker-stopped", options.onSpeakerStopped);
    }
    if (options.onTranscriptSegment) {
      socket.on("transcript-segment", options.onTranscriptSegment);
    }
    if (options.onPoiOffer) {
      socket.on("poi-offer", options.onPoiOffer);
    }
    if (options.onPoiResult) {
      socket.on("poi-result", options.onPoiResult);
    }
    if (options.onTimerPaused) {
      socket.on("timer-paused", options.onTimerPaused);
    }
    if (options.onTimerResumed) {
      socket.on("timer-resumed", options.onTimerResumed);
    }
    if (options.onDebateStarted) {
      socket.on("debate-started", options.onDebateStarted);
    }
    if (options.onDebateEnded) {
      socket.on("debate-ended", options.onDebateEnded);
    }
    if (options.onSpeakerAdvanced) {
      socket.on("speaker-advanced", options.onSpeakerAdvanced);
    }
    if (options.onViolationFlagged) {
      socket.on("violation-flagged", options.onViolationFlagged);
    }
    if (options.onRoomState) {
      socket.on("room-state", options.onRoomState);
    }
    if (options.onAudioStream) {
      socket.on("audio-stream", options.onAudioStream);
    }
    if (options.onParticipantsUpdated) {
      socket.on("participants-updated", options.onParticipantsUpdated);
    }
    if (options.onError) {
      socket.on("error", options.onError);
    }

    return () => {
      socket.disconnect();
    };
  }, [options.roomCode, options.participantId, options.userId]);

  const joinRoom = useCallback((roomCode: string, participantId: number, userId: number) => {
    socketRef.current?.emit("join-room", { roomCode, participantId, userId });
  }, []);

  const leaveRoom = useCallback(() => {
    socketRef.current?.emit("leave-room");
  }, []);

  const startSpeaking = useCallback((speechId: number) => {
    socketRef.current?.emit("start-speaking", { speechId });
  }, []);

  const stopSpeaking = useCallback((speechId: number) => {
    socketRef.current?.emit("stop-speaking", { speechId });
  }, []);

  const sendAudioData = useCallback((audioChunk: ArrayBuffer) => {
    socketRef.current?.emit("audio-data", { audioChunk });
  }, []);

  const sendTranscriptUpdate = useCallback((speechId: number, text: string, timestamp: number) => {
    socketRef.current?.emit("transcript-update", { speechId, text, timestamp });
  }, []);

  const offerPoi = useCallback((targetSpeechId: number, timestamp: number) => {
    socketRef.current?.emit("poi-offered", { targetSpeechId, timestamp });
  }, []);

  const respondToPoi = useCallback((accepted: boolean, poiId?: number) => {
    socketRef.current?.emit("poi-response", { accepted, poiId });
  }, []);

  const pauseTimer = useCallback(() => {
    socketRef.current?.emit("timer-pause");
  }, []);

  const resumeTimer = useCallback(() => {
    socketRef.current?.emit("timer-resume");
  }, []);

  const startDebate = useCallback(() => {
    socketRef.current?.emit("debate-start");
  }, []);

  const advanceSpeaker = useCallback((nextSpeaker: string) => {
    socketRef.current?.emit("advance-speaker", { nextSpeaker });
  }, []);

  const endDebate = useCallback(() => {
    socketRef.current?.emit("debate-end");
  }, []);

  const reportViolation = useCallback((violationType: string, description: string) => {
    socketRef.current?.emit("rule-violation", { violationType, description });
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    joinRoom,
    leaveRoom,
    startSpeaking,
    stopSpeaking,
    sendAudioData,
    sendTranscriptUpdate,
    offerPoi,
    respondToPoi,
    pauseTimer,
    resumeTimer,
    startDebate,
    advanceSpeaker,
    endDebate,
    reportViolation,
  };
}
