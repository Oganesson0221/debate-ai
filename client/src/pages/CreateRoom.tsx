import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Loader2, Sparkles, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";

const TOPICS = [
  { value: "politics", label: "Politics" },
  { value: "ethics", label: "Ethics" },
  { value: "technology", label: "Technology" },
  { value: "economics", label: "Economics" },
  { value: "social", label: "Social Issues" },
  { value: "environment", label: "Environment" },
  { value: "education", label: "Education" },
  { value: "health", label: "Health" },
];

const DIFFICULTIES = [
  { value: "novice", label: "Novice", desc: "Clear topics with obvious clash points" },
  { value: "intermediate", label: "Intermediate", desc: "Nuanced policy debates" },
  { value: "advanced", label: "Advanced", desc: "Complex philosophical topics" },
];

export default function CreateRoom() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  
  const [step, setStep] = useState<"motion" | "room">("motion");
  const [motionType, setMotionType] = useState<"generate" | "custom">("generate");
  const [topic, setTopic] = useState("politics");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [customMotion, setCustomMotion] = useState("");
  const [generatedMotion, setGeneratedMotion] = useState<any>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateMotion = trpc.motion.generate.useMutation({
    onSuccess: (data) => {
      setGeneratedMotion(data);
      toast.success("Motion generated!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createMotion = trpc.motion.create.useMutation({
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const createDebate = trpc.debate.create.useMutation({
    onSuccess: (data) => {
      setRoomCode(data.roomCode);
      setStep("room");
      toast.success("Room created!");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleGenerateMotion = () => {
    generateMotion.mutate({
      topic: topic as any,
      difficulty: difficulty as any,
      format: "asian_parliamentary",
    });
  };

  const handleCreateRoom = async () => {
    let motionId: number | undefined;

    if (motionType === "generate" && generatedMotion) {
      motionId = generatedMotion.id;
    } else if (motionType === "custom" && customMotion.trim()) {
      const result = await createMotion.mutateAsync({
        title: customMotion,
        topic: topic as any,
        difficulty: difficulty as any,
        format: "asian_parliamentary",
      });
      motionId = result.id;
    }

    createDebate.mutate({
      motionId,
      format: "asian_parliamentary",
    });
  };

  const copyRoomCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      toast.success("Room code copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-black uppercase mb-4">Sign In Required</h1>
          <p className="text-muted-foreground mb-8">Please sign in to create a debate room.</p>
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-4 border-foreground">
        <div className="container flex items-center h-20">
          <Link href="/" className="no-underline hover:bg-transparent">
            <span className="text-2xl font-black tracking-tighter uppercase">
              [DEBATE.AI]
            </span>
          </Link>
        </div>
      </header>

      <main className="container py-12">
        <div className="max-w-3xl mx-auto">
          {/* Back link */}
          <Link href="/" className="inline-flex items-center gap-2 mb-8 font-bold uppercase tracking-wider text-sm hover:underline decoration-2 underline-offset-4 no-underline hover:bg-transparent">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>

          {step === "motion" ? (
            <>
              <div className="mb-12">
                <h1 className="text-display mb-4">CREATE ROOM</h1>
                <p className="text-xl text-muted-foreground">
                  Set up your debate motion and create a room for your team.
                </p>
              </div>

              {/* Motion Type Selection */}
              <div className="grid md:grid-cols-2 gap-6 mb-12">
                <button
                  onClick={() => setMotionType("generate")}
                  className={`brutalist-border p-6 text-left transition-all ${
                    motionType === "generate" 
                      ? "bg-foreground text-background brutalist-shadow" 
                      : "hover:bg-muted"
                  }`}
                >
                  <Sparkles className="h-8 w-8 mb-4" />
                  <h3 className="text-xl font-black uppercase mb-2">AI Generated</h3>
                  <p className={motionType === "generate" ? "text-background/80" : "text-muted-foreground"}>
                    Let AI create a balanced, debatable motion based on your preferences.
                  </p>
                </button>
                <button
                  onClick={() => setMotionType("custom")}
                  className={`brutalist-border p-6 text-left transition-all ${
                    motionType === "custom" 
                      ? "bg-foreground text-background brutalist-shadow" 
                      : "hover:bg-muted"
                  }`}
                >
                  <ArrowRight className="h-8 w-8 mb-4" />
                  <h3 className="text-xl font-black uppercase mb-2">Custom Motion</h3>
                  <p className={motionType === "custom" ? "text-background/80" : "text-muted-foreground"}>
                    Enter your own motion for the debate.
                  </p>
                </button>
              </div>

              {/* Motion Configuration */}
              <div className="space-y-8">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-black uppercase tracking-wider">Topic Area</Label>
                    <Select value={topic} onValueChange={setTopic}>
                      <SelectTrigger className="brutalist-border h-14 text-lg font-bold uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TOPICS.map((t) => (
                          <SelectItem key={t.value} value={t.value} className="font-bold uppercase">
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-sm font-black uppercase tracking-wider">Difficulty</Label>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger className="brutalist-border h-14 text-lg font-bold uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIFFICULTIES.map((d) => (
                          <SelectItem key={d.value} value={d.value} className="font-bold uppercase">
                            {d.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {motionType === "generate" ? (
                  <div className="space-y-6">
                    <Button
                      onClick={handleGenerateMotion}
                      disabled={generateMotion.isPending}
                      className="brutalist-border brutalist-shadow-hover transition-all uppercase font-black tracking-wider px-8 py-6 h-auto text-lg w-full md:w-auto"
                    >
                      {generateMotion.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5" />
                          Generate Motion
                        </>
                      )}
                    </Button>

                    {generatedMotion && (
                      <Card className="brutalist-border brutalist-shadow p-8 animate-brutalist-appear">
                        <h3 className="text-2xl font-black uppercase mb-4">Generated Motion</h3>
                        <p className="text-xl font-bold mb-6">{generatedMotion.title}</p>
                        {generatedMotion.backgroundContext && (
                          <div className="mb-4">
                            <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                              Background Context
                            </p>
                            <p className="text-muted-foreground">{generatedMotion.backgroundContext}</p>
                          </div>
                        )}
                        {generatedMotion.stakeholders && generatedMotion.stakeholders.length > 0 && (
                          <div>
                            <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                              Key Stakeholders
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {generatedMotion.stakeholders.map((s: string, i: number) => (
                                <span key={i} className="brutalist-border px-3 py-1 text-sm font-bold">
                                  {s}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <Label className="text-sm font-black uppercase tracking-wider">Your Motion</Label>
                    <Textarea
                      value={customMotion}
                      onChange={(e) => setCustomMotion(e.target.value)}
                      placeholder="This House believes that..."
                      className="brutalist-border min-h-32 text-lg"
                    />
                  </div>
                )}

                <div className="pt-8 border-t-4 border-foreground">
                  <Button
                    onClick={handleCreateRoom}
                    disabled={
                      createDebate.isPending || 
                      (motionType === "generate" && !generatedMotion) ||
                      (motionType === "custom" && !customMotion.trim())
                    }
                    className="brutalist-border brutalist-shadow-lg brutalist-shadow-hover transition-all uppercase font-black tracking-wider px-12 py-8 h-auto text-xl"
                  >
                    {createDebate.isPending ? (
                      <>
                        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                        Creating Room...
                      </>
                    ) : (
                      <>
                        Create Room
                        <ArrowRight className="ml-3 h-6 w-6" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* Room Created */
            <div className="text-center py-12">
              <div className="inline-block brutalist-border-thick brutalist-shadow-lg p-12 mb-8 animate-brutalist-appear">
                <p className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">
                  Room Code
                </p>
                <p className="text-massive tracking-widest">{roomCode}</p>
              </div>

              <p className="text-xl text-muted-foreground mb-8 max-w-md mx-auto">
                Share this code with your team members to join the debate room.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={copyRoomCode}
                  variant="outline"
                  className="brutalist-border bg-transparent uppercase font-black tracking-wider px-8 py-6 h-auto text-lg"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 h-5 w-5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-5 w-5" />
                      Copy Code
                    </>
                  )}
                </Button>
                <Link href={`/room/${roomCode}`}>
                  <Button className="brutalist-border brutalist-shadow-hover transition-all uppercase font-black tracking-wider px-8 py-6 h-auto text-lg">
                    Enter Room
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              {generatedMotion && (
                <Card className="brutalist-border mt-12 p-8 text-left max-w-2xl mx-auto">
                  <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                    Motion
                  </p>
                  <p className="text-xl font-bold">{generatedMotion.title}</p>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
