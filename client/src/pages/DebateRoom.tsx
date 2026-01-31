import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { useSocket } from "@/hooks/useSocket";
import { 
  ArrowLeft, Mic, MicOff, Play, Pause, Square, 
  Users, Clock, AlertTriangle, Hand, ChevronRight,
  Loader2, Copy, Check
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

const AP_SPEAKER_ORDER = ['pm', 'lo', 'dpm', 'dlo', 'gw', 'ow', 'pmr', 'lor'] as const;
const AP_SPEECH_TIMES: Record<string, number> = {
  pm: 7 * 60,
  lo: 7 * 60,
  dpm: 7 * 60,
  dlo: 7 * 60,
  gw: 7 * 60,
  ow: 7 * 60,
  pmr: 4 * 60,
  lor: 4 * 60,
};

const SPEAKER_NAMES: Record<string, string> = {
  pm: "Prime Minister",
  lo: "Leader of Opposition",
  dpm: "Deputy Prime Minister",
  dlo: "Deputy Leader of Opposition",
  gw: "Government Whip",
  ow: "Opposition Whip",
  pmr: "PM Reply",
  lor: "LO Reply",
};

const PROTECTED_TIME = 60; // First and last minute

export default function DebateRoom() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user, isAuthenticated } = useAuth();
  
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [allTranscripts, setAllTranscripts] = useState<Array<{ speaker: string; text: string; timestamp: number }>>([]);
  const [timer, setTimer] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSpeakerIndex, setCurrentSpeakerIndex] = useState(0);
  const [poiOffered, setPoiOffered] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch room data
  const { data: roomData, isLoading, refetch } = trpc.debate.getByRoomCode.useQuery(
    { roomCode: roomCode || "" },
    { enabled: !!roomCode }
  );

  const startDebate = trpc.debate.start.useMutation({
    onSuccess: () => {
      toast.success("Debate started!");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const advanceSpeaker = trpc.debate.advanceSpeaker.useMutation({
    onSuccess: (data) => {
      if (data.finished) {
        toast.success("Debate completed!");
      } else {
        toast.success(`Next speaker: ${SPEAKER_NAMES[data.nextSpeaker || '']}`);
      }
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  const endDebate = trpc.debate.end.useMutation({
    onSuccess: () => {
      toast.success("Debate ended. Generating feedback...");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  // Get current participant
  const currentParticipant = roomData?.participants?.find(
    (p) => p.userId === user?.id
  );

  // Socket connection
  const socket = useSocket({
    roomCode: roomCode,
    participantId: currentParticipant?.id,
    userId: user?.id,
    onParticipantJoined: (data) => {
      toast.info(`${SPEAKER_NAMES[data.speakerRole]} joined`);
      refetch();
    },
    onParticipantLeft: (data) => {
      toast.info(`${SPEAKER_NAMES[data.speakerRole]} left`);
      refetch();
    },
    onSpeakerStarted: (data) => {
      setCurrentSpeakerIndex(AP_SPEAKER_ORDER.indexOf(data.speakerRole));
      setTimer(0);
      startTimer();
    },
    onSpeakerStopped: (data) => {
      stopTimer();
    },
    onTranscriptSegment: (data) => {
      setAllTranscripts(prev => [...prev, {
        speaker: data.senderId,
        text: data.text,
        timestamp: data.timestamp,
      }]);
    },
    onPoiOffer: (data) => {
      toast.info(`POI offered by ${SPEAKER_NAMES[data.speakerRole]}`);
    },
    onDebateStarted: () => {
      toast.success("Debate has started!");
      setCurrentSpeakerIndex(0);
      refetch();
    },
    onDebateEnded: () => {
      toast.success("Debate has ended!");
      refetch();
    },
    onSpeakerAdvanced: (data) => {
      const idx = AP_SPEAKER_ORDER.indexOf(data.nextSpeaker);
      setCurrentSpeakerIndex(idx);
      setTimer(0);
    },
    onViolationFlagged: (data) => {
      toast.warning(`Rule violation: ${data.description}`);
    },
    onRoomState: (data) => {
      setCurrentSpeakerIndex(data.currentSpeakerIndex || 0);
    },
  });

  // Timer functions
  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimer(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const togglePause = () => {
    if (isPaused) {
      startTimer();
      socket.resumeTimer();
    } else {
      stopTimer();
      socket.pauseTimer();
    }
    setIsPaused(!isPaused);
  };

  // Recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      socket.startSpeaking(0); // TODO: Pass actual speech ID
      startTimer();
    } catch (error) {
      toast.error("Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      socket.stopSpeaking(0);
      stopTimer();
    }
  };

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get timer status
  const currentSpeaker = AP_SPEAKER_ORDER[currentSpeakerIndex];
  const maxTime = AP_SPEECH_TIMES[currentSpeaker] || 420;
  const timeRemaining = maxTime - timer;
  const isProtected = timer < PROTECTED_TIME || timeRemaining < PROTECTED_TIME;
  const isOvertime = timer > maxTime;

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success("Room code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopTimer]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black uppercase mb-4">Sign In Required</h1>
          <Link href="/">
            <Button className="brutalist-border">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!roomData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black uppercase mb-4">Room Not Found</h1>
          <Link href="/">
            <Button className="brutalist-border">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const session = roomData.session;
  const motion = roomData.motion;
  const participants = roomData.participants || [];
  const govTeam = participants.filter(p => p.team === "government");
  const oppTeam = participants.filter(p => p.team === "opposition");
  const isCreator = session?.createdBy === user?.id;
  const canStart = isCreator && session?.status === "waiting" && participants.length >= 2;
  const isMyTurn = currentParticipant?.speakerRole === currentSpeaker && session?.status === "in_progress";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b-4 border-foreground shrink-0">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="no-underline hover:bg-transparent">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <span className="text-xl font-black tracking-tighter uppercase">
              [DEBATE.AI]
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-2 brutalist-border px-4 py-2 font-black uppercase tracking-wider text-sm hover:bg-foreground hover:text-background transition-colors"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {roomCode}
            </button>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <span className="font-bold">{participants.length}/6</span>
            </div>
            <span className={`px-3 py-1 text-sm font-black uppercase ${
              session?.status === "waiting" 
                ? "bg-muted" 
                : session?.status === "in_progress"
                ? "bg-foreground text-background animate-pulse"
                : "bg-muted-foreground text-background"
            }`}>
              {session?.status}
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Left Panel - Teams */}
        <div className="w-80 border-r-4 border-foreground flex flex-col shrink-0">
          {/* Government Team */}
          <div className="flex-1 border-b-4 border-foreground p-4 overflow-auto">
            <h3 className="font-black uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-foreground"></div>
              Government
            </h3>
            <div className="space-y-2">
              {['pm', 'dpm', 'gw'].map((role) => {
                const participant = govTeam.find(p => p.speakerRole === role);
                const isActive = currentSpeaker === role && session?.status === "in_progress";
                return (
                  <div 
                    key={role}
                    className={`brutalist-border p-3 transition-all ${
                      isActive ? "bg-foreground text-background animate-pulse-border" : ""
                    } ${participant ? "" : "opacity-50"}`}
                  >
                    <p className="font-black uppercase text-sm">{SPEAKER_NAMES[role]}</p>
                    <p className="text-xs opacity-70">
                      {participant ? `User ${participant.userId}` : "Empty"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Opposition Team */}
          <div className="flex-1 p-4 overflow-auto">
            <h3 className="font-black uppercase tracking-wider text-sm mb-4 flex items-center gap-2">
              <div className="w-3 h-3 bg-muted-foreground"></div>
              Opposition
            </h3>
            <div className="space-y-2">
              {['lo', 'dlo', 'ow'].map((role) => {
                const participant = oppTeam.find(p => p.speakerRole === role);
                const isActive = currentSpeaker === role && session?.status === "in_progress";
                return (
                  <div 
                    key={role}
                    className={`brutalist-border p-3 transition-all ${
                      isActive ? "bg-muted-foreground text-background animate-pulse-border" : ""
                    } ${participant ? "" : "opacity-50"}`}
                  >
                    <p className="font-black uppercase text-sm">{SPEAKER_NAMES[role]}</p>
                    <p className="text-xs opacity-70">
                      {participant ? `User ${participant.userId}` : "Empty"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Panel - Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Motion */}
          <div className="border-b-4 border-foreground p-6 shrink-0">
            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2">
              Motion
            </p>
            <p className="text-xl font-bold">
              {motion?.title || "No motion set"}
            </p>
          </div>

          {/* Timer & Controls */}
          <div className="border-b-4 border-foreground p-6 shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-1">
                  {session?.status === "in_progress" ? "Current Speaker" : "Next Speaker"}
                </p>
                <p className="text-2xl font-black uppercase">
                  {SPEAKER_NAMES[currentSpeaker]}
                </p>
              </div>
              
              <div className="text-center">
                <div className={`text-6xl font-black tabular-nums ${
                  isOvertime ? "text-destructive animate-pulse" : 
                  timeRemaining < 60 ? "timer-warning" : ""
                }`}>
                  {isOvertime ? `-${formatTime(timer - maxTime)}` : formatTime(timeRemaining)}
                </div>
                {isProtected && session?.status === "in_progress" && (
                  <p className="text-sm font-bold uppercase text-muted-foreground mt-1">
                    Protected Time
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                {session?.status === "waiting" && canStart && (
                  <Button
                    onClick={() => startDebate.mutate({ sessionId: session.id })}
                    disabled={startDebate.isPending}
                    className="brutalist-border brutalist-shadow-hover uppercase font-black"
                  >
                    {startDebate.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Play className="h-5 w-5 mr-2" />
                        Start
                      </>
                    )}
                  </Button>
                )}
                
                {session?.status === "in_progress" && (
                  <>
                    <Button
                      onClick={togglePause}
                      variant="outline"
                      className="brutalist-border bg-transparent uppercase font-black"
                    >
                      {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
                    </Button>
                    
                    {isCreator && (
                      <>
                        <Button
                          onClick={() => advanceSpeaker.mutate({ sessionId: session.id })}
                          disabled={advanceSpeaker.isPending}
                          className="brutalist-border brutalist-shadow-hover uppercase font-black"
                        >
                          <ChevronRight className="h-5 w-5 mr-1" />
                          Next
                        </Button>
                        <Button
                          onClick={() => endDebate.mutate({ sessionId: session.id })}
                          disabled={endDebate.isPending}
                          variant="outline"
                          className="brutalist-border bg-transparent uppercase font-black text-destructive"
                        >
                          <Square className="h-5 w-5 mr-1" />
                          End
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Speaker Order Progress */}
            <div className="mt-6 flex gap-1">
              {AP_SPEAKER_ORDER.map((role, idx) => (
                <div
                  key={role}
                  className={`flex-1 h-2 transition-all ${
                    idx < currentSpeakerIndex 
                      ? "bg-foreground" 
                      : idx === currentSpeakerIndex && session?.status === "in_progress"
                      ? "bg-foreground animate-pulse"
                      : "bg-muted"
                  }`}
                  title={SPEAKER_NAMES[role]}
                />
              ))}
            </div>
          </div>

          {/* Transcript Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b-4 border-foreground shrink-0">
              <h3 className="font-black uppercase tracking-wider text-sm">Live Transcript</h3>
            </div>
            <ScrollArea className="flex-1 p-4">
              {allTranscripts.length === 0 ? (
                <p className="text-muted-foreground text-center py-12">
                  Transcripts will appear here during the debate...
                </p>
              ) : (
                <div className="space-y-4">
                  {allTranscripts.map((t, i) => (
                    <div key={i} className="brutalist-border p-4">
                      <p className="text-sm font-black uppercase text-muted-foreground mb-1">
                        {t.speaker} • {formatTime(Math.floor(t.timestamp / 1000))}
                      </p>
                      <p>{t.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Recording Controls */}
          {isMyTurn && (
            <div className="border-t-4 border-foreground p-6 shrink-0 bg-foreground text-background">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-black uppercase">Your Turn to Speak</p>
                  <p className="text-sm opacity-70">
                    {isRecording ? "Recording in progress..." : "Click to start speaking"}
                  </p>
                </div>
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  className={`brutalist-border px-8 py-6 h-auto uppercase font-black text-lg ${
                    isRecording 
                      ? "bg-destructive text-destructive-foreground border-destructive" 
                      : "bg-background text-foreground"
                  }`}
                >
                  {isRecording ? (
                    <>
                      <MicOff className="h-6 w-6 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="h-6 w-6 mr-2" />
                      Start Speaking
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* POI Button */}
          {session?.status === "in_progress" && !isMyTurn && !isProtected && currentParticipant && (
            <div className="border-t-4 border-foreground p-4 shrink-0">
              <Button
                onClick={() => {
                  socket.offerPoi(0, timer * 1000);
                  setPoiOffered(true);
                  setTimeout(() => setPoiOffered(false), 3000);
                }}
                disabled={poiOffered}
                variant="outline"
                className="brutalist-border bg-transparent uppercase font-black w-full"
              >
                <Hand className="h-5 w-5 mr-2" />
                {poiOffered ? "POI Offered" : "Offer POI"}
              </Button>
            </div>
          )}
        </div>

        {/* Right Panel - Info */}
        <div className="w-80 border-l-4 border-foreground flex flex-col shrink-0">
          <div className="p-4 border-b-4 border-foreground">
            <h3 className="font-black uppercase tracking-wider text-sm">Speaker Order</h3>
          </div>
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {AP_SPEAKER_ORDER.map((role, idx) => {
                const isGov = ['pm', 'dpm', 'gw', 'pmr'].includes(role);
                const isActive = idx === currentSpeakerIndex && session?.status === "in_progress";
                const isDone = idx < currentSpeakerIndex;
                return (
                  <div 
                    key={role}
                    className={`brutalist-border p-3 transition-all ${
                      isActive 
                        ? isGov ? "bg-foreground text-background" : "bg-muted-foreground text-background"
                        : isDone ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-black uppercase text-sm">{SPEAKER_NAMES[role]}</p>
                        <p className="text-xs opacity-70">
                          {AP_SPEECH_TIMES[role] / 60} min
                        </p>
                      </div>
                      <span className={`text-xs font-bold uppercase ${
                        isGov ? "" : "opacity-70"
                      }`}>
                        {isGov ? "GOV" : "OPP"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Rules */}
          <div className="p-4 border-t-4 border-foreground">
            <h3 className="font-black uppercase tracking-wider text-sm mb-3">Rules</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>No POIs in protected time (first/last minute)</span>
              </div>
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>No new arguments in reply speeches</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
