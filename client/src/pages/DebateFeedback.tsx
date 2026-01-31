import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, ArrowRight, Loader2, Download, Share2,
  Target, MessageSquare, TrendingUp, AlertTriangle,
  CheckCircle2, XCircle, Lightbulb, BarChart3
} from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

export default function DebateFeedback() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user, isAuthenticated } = useAuth();

  // Fetch room data
  const { data: roomData, isLoading } = trpc.debate.getByRoomCode.useQuery(
    { roomCode: roomCode || "" },
    { enabled: !!roomCode }
  );

  // Generate feedback mutation
  const generateFeedback = trpc.feedback.generate.useMutation({
    onSuccess: () => {
      toast.success("Feedback generated!");
    },
    onError: (error) => toast.error(error.message),
  });

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
          <Link href="/dashboard">
            <Button className="brutalist-border">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const session = roomData.session;
  const feedback = roomData.feedback || [];
  const myFeedback = feedback.find(f => f.participantId === roomData.participants?.find(p => p.userId === user?.id)?.id);
  const myMetrics = roomData.metrics?.find((m: any) => m.userId === user?.id);
  const motion = roomData.motion;

  // Parse feedback content
  const parseFeedbackContent = (feedback: typeof myFeedback) => {
    if (!feedback) return null;
    return {
      strengths: feedback.strongestArguments,
      improvements: feedback.improvementSuggestions?.map(s => s.suggestion),
      missedResponses: feedback.missedResponses,
      suggestions: feedback.improvementSuggestions?.map(s => `${s.area}: ${s.suggestion}`),
    };
  };

  const feedbackContent = parseFeedbackContent(myFeedback);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-4 border-foreground">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href={`/room/${roomCode}`} className="no-underline hover:bg-transparent">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <span className="text-xl font-black tracking-tighter uppercase">
              Debate Feedback
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/room/${roomCode}/mindmap`}>
              <Button variant="outline" className="brutalist-border bg-transparent uppercase font-black text-sm">
                View Mindmap
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container py-12">
        {/* Motion Header */}
        <div className="mb-12">
          <p className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-2">
            Motion
          </p>
          <h1 className="text-2xl md:text-3xl font-bold mb-4">
            {motion?.title || "No motion"}
          </h1>
          <div className="flex items-center gap-4">
            <span className="brutalist-border px-4 py-2 font-black uppercase">
              {roomCode}
            </span>
            <span className={`px-4 py-2 font-black uppercase ${
              session?.status === "completed" 
                ? "bg-foreground text-background" 
                : "bg-muted"
            }`}>
              {session?.status}
            </span>
          </div>
        </div>

        {session?.status !== "completed" ? (
          <Card className="brutalist-border p-12 text-center">
            <AlertTriangle className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
            <h2 className="text-2xl font-black uppercase mb-4">Debate Not Complete</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Feedback will be available once the debate has ended. Return to the debate room to continue.
            </p>
            <Link href={`/room/${roomCode}`}>
              <Button className="brutalist-border brutalist-shadow-hover uppercase font-black">
                Return to Debate
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </Card>
        ) : !myFeedback ? (
          <Card className="brutalist-border p-12 text-center">
            <BarChart3 className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
            <h2 className="text-2xl font-black uppercase mb-4">Generate Your Feedback</h2>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              Get AI-powered analysis of your debate performance with personalized improvement suggestions.
            </p>
            <Button 
              onClick={() => generateFeedback.mutate({ sessionId: session.id })}
              disabled={generateFeedback.isPending}
              className="brutalist-border brutalist-shadow-lg brutalist-shadow-hover uppercase font-black px-8 py-6 h-auto text-lg"
            >
              {generateFeedback.isPending ? (
                <>
                  <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  Generate Feedback
                  <ArrowRight className="ml-3 h-6 w-6" />
                </>
              )}
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Overall Score */}
            <div className="grid md:grid-cols-4 gap-6">
              <Card className="brutalist-border-thick p-6 md:col-span-1">
                <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                  Overall Score
                </p>
                <p className="text-6xl font-black">
                  {myFeedback.overallScore 
                    ? Math.round(myFeedback.overallScore * 100) 
                    : "—"}
                </p>
                <p className="text-muted-foreground font-bold uppercase text-sm mt-2">
                  / 100
                </p>
              </Card>

              <Card className="brutalist-border p-6">
                <Target className="h-8 w-8 mb-3 text-muted-foreground" />
                <p className="text-3xl font-black">
                  {myMetrics?.argumentCompleteness 
                    ? Math.round(myMetrics.argumentCompleteness * 100) 
                    : "—"}%
                </p>
                <p className="text-sm font-bold uppercase text-muted-foreground">
                  Argument Structure
                </p>
              </Card>

              <Card className="brutalist-border p-6">
                <MessageSquare className="h-8 w-8 mb-3 text-muted-foreground" />
                <p className="text-3xl font-black">
                  {myMetrics?.rebuttalQuality 
                    ? Math.round(myMetrics.rebuttalQuality * 100) 
                    : "—"}%
                </p>
                <p className="text-sm font-bold uppercase text-muted-foreground">
                  Rebuttal Quality
                </p>
              </Card>

              <Card className="brutalist-border p-6">
                <TrendingUp className="h-8 w-8 mb-3 text-muted-foreground" />
                <p className="text-3xl font-black">
                  {myMetrics?.responsivenessScore 
                    ? Math.round(myMetrics.responsivenessScore * 100) 
                    : "—"}%
                </p>
                <p className="text-sm font-bold uppercase text-muted-foreground">
                  Responsiveness
                </p>
              </Card>
            </div>

            {/* Detailed Metrics */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="brutalist-border p-6">
                <p className="font-black uppercase mb-4">Weighing Usage</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-muted">
                    <div 
                      className="h-full bg-foreground transition-all"
                      style={{ width: `${(myMetrics?.weighingUsage || 0) * 100}%` }}
                    />
                  </div>
                  <span className="font-black text-xl">
                    {myMetrics?.weighingUsage ? Math.round(myMetrics.weighingUsage * 100) : 0}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  How well you compared and prioritized arguments
                </p>
              </Card>

              <Card className="brutalist-border p-6">
                <p className="font-black uppercase mb-4">Role Fulfillment</p>
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-4 bg-muted">
                    <div 
                      className="h-full bg-foreground transition-all"
                      style={{ width: `${(myMetrics?.roleFulfillment || 0) * 100}%` }}
                    />
                  </div>
                  <span className="font-black text-xl">
                    {myMetrics?.roleFulfillment ? Math.round(myMetrics.roleFulfillment * 100) : 0}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  How well you executed your speaker role duties
                </p>
              </Card>
            </div>

            {/* Feedback Content Tabs */}
            {feedbackContent && (
              <Tabs defaultValue="strengths" className="w-full">
                <TabsList className="brutalist-border w-full grid grid-cols-4 h-auto p-0">
                  <TabsTrigger 
                    value="strengths" 
                    className="brutalist-border-0 data-[state=active]:bg-foreground data-[state=active]:text-background uppercase font-black py-4"
                  >
                    Strengths
                  </TabsTrigger>
                  <TabsTrigger 
                    value="improvements" 
                    className="brutalist-border-0 data-[state=active]:bg-foreground data-[state=active]:text-background uppercase font-black py-4"
                  >
                    Improvements
                  </TabsTrigger>
                  <TabsTrigger 
                    value="missed" 
                    className="brutalist-border-0 data-[state=active]:bg-foreground data-[state=active]:text-background uppercase font-black py-4"
                  >
                    Missed
                  </TabsTrigger>
                  <TabsTrigger 
                    value="suggestions" 
                    className="brutalist-border-0 data-[state=active]:bg-foreground data-[state=active]:text-background uppercase font-black py-4"
                  >
                    Suggestions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="strengths" className="mt-6">
                  <Card className="brutalist-border p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                      <h3 className="text-xl font-black uppercase">Strongest Arguments</h3>
                    </div>
                    {feedbackContent.strengths ? (
                      <div className="space-y-4">
                        {(Array.isArray(feedbackContent.strengths) 
                          ? feedbackContent.strengths 
                          : [feedbackContent.strengths]
                        ).map((strength: string, idx: number) => (
                          <div key={idx} className="brutalist-border p-4 bg-green-50">
                            <p>{strength}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No specific strengths identified.</p>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="improvements" className="mt-6">
                  <Card className="brutalist-border p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <TrendingUp className="h-6 w-6 text-amber-600" />
                      <h3 className="text-xl font-black uppercase">Areas for Improvement</h3>
                    </div>
                    {feedbackContent.improvements ? (
                      <div className="space-y-4">
                        {(Array.isArray(feedbackContent.improvements) 
                          ? feedbackContent.improvements 
                          : [feedbackContent.improvements]
                        ).map((improvement: string, idx: number) => (
                          <div key={idx} className="brutalist-border p-4 bg-amber-50">
                            <p>{improvement}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No specific improvements identified.</p>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="missed" className="mt-6">
                  <Card className="brutalist-border p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <XCircle className="h-6 w-6 text-destructive" />
                      <h3 className="text-xl font-black uppercase">Missed Responses</h3>
                    </div>
                    {feedbackContent.missedResponses ? (
                      <div className="space-y-4">
                        {(Array.isArray(feedbackContent.missedResponses) 
                          ? feedbackContent.missedResponses 
                          : [feedbackContent.missedResponses]
                        ).map((missed: string, idx: number) => (
                          <div key={idx} className="brutalist-border p-4 bg-red-50">
                            <p>{missed}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No missed responses identified.</p>
                    )}
                  </Card>
                </TabsContent>

                <TabsContent value="suggestions" className="mt-6">
                  <Card className="brutalist-border p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Lightbulb className="h-6 w-6 text-blue-600" />
                      <h3 className="text-xl font-black uppercase">Improvement Suggestions</h3>
                    </div>
                    {feedbackContent.suggestions ? (
                      <div className="space-y-4">
                        {(Array.isArray(feedbackContent.suggestions) 
                          ? feedbackContent.suggestions 
                          : [feedbackContent.suggestions]
                        ).map((suggestion: string, idx: number) => (
                          <div key={idx} className="brutalist-border p-4 bg-blue-50">
                            <div className="flex items-start gap-3">
                              <span className="font-black text-lg">{idx + 1}.</span>
                              <p>{suggestion}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No specific suggestions available.</p>
                    )}
                  </Card>
                </TabsContent>
              </Tabs>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-4 pt-8 border-t-4 border-foreground">
              <Link href={`/room/${roomCode}/mindmap`}>
                <Button className="brutalist-border brutalist-shadow-hover uppercase font-black">
                  View Argument Mindmap
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="outline" className="brutalist-border bg-transparent uppercase font-black">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
