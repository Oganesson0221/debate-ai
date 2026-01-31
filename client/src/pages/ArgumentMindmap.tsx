import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, ArrowRight, Loader2, ZoomIn, ZoomOut, 
  Maximize2, RefreshCw, ChevronRight, X
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

interface ArgumentNode {
  id: number;
  claim: string;
  mechanism: string | null;
  impact: string | null;
  team: string;
  type: string;
  qualityScore: number | null;
  strengthExplanation: string | null;
  weaknessExplanation: string | null;
  transcriptExcerpt: string | null;
  wasAnswered: boolean | null;
  x?: number;
  y?: number;
}

interface ArgumentRelationship {
  id: number;
  sourceArgumentId: number;
  targetArgumentId: number;
  relationshipType: string;
  strength: number | null;
}

export default function ArgumentMindmap() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { isAuthenticated } = useAuth();
  
  const [selectedNode, setSelectedNode] = useState<ArgumentNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Fetch room data
  const { data: roomData, isLoading } = trpc.debate.getByRoomCode.useQuery(
    { roomCode: roomCode || "" },
    { enabled: !!roomCode }
  );

  // Fetch arguments
  const { data: argumentData, isLoading: argsLoading, refetch } = trpc.argument.list.useQuery(
    { sessionId: roomData?.session?.id || 0 },
    { enabled: !!roomData?.session?.id }
  );

  // Analyze clashes mutation
  const analyzeClashes = trpc.argument.analyzeClashes.useMutation({
    onSuccess: () => {
      toast.success("Clash analysis complete!");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  // Calculate node positions
  const calculatePositions = useCallback((args: ArgumentNode[]): ArgumentNode[] => {
    const govArgs = args.filter(a => a.team === "government");
    const oppArgs = args.filter(a => a.team === "opposition");
    
    const centerX = 600;
    const startY = 100;
    const nodeSpacing = 150;
    const teamOffset = 300;

    // Position government arguments on the left
    govArgs.forEach((arg, idx) => {
      arg.x = centerX - teamOffset;
      arg.y = startY + idx * nodeSpacing;
    });

    // Position opposition arguments on the right
    oppArgs.forEach((arg, idx) => {
      arg.x = centerX + teamOffset;
      arg.y = startY + idx * nodeSpacing;
    });

    return [...govArgs, ...oppArgs];
  }, []);

  const positionedArgs = argumentData?.arguments 
    ? calculatePositions(argumentData.arguments as ArgumentNode[])
    : [];

  const relationships = argumentData?.relationships || [];

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Get relationship color
  const getRelationshipColor = (type: string) => {
    switch (type) {
      case "supports": return "#22c55e";
      case "rebuts": return "#ef4444";
      case "clashes": return "#f59e0b";
      case "extends": return "#3b82f6";
      default: return "#6b7280";
    }
  };

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

  if (isLoading || argsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b-4 border-foreground shrink-0">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href={`/room/${roomCode}`} className="no-underline hover:bg-transparent">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <span className="text-xl font-black tracking-tighter uppercase">
              Argument Mindmap
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => analyzeClashes.mutate({ sessionId: roomData?.session?.id || 0 })}
              disabled={analyzeClashes.isPending}
              className="brutalist-border uppercase font-black text-sm"
            >
              {analyzeClashes.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Analyze Clashes
            </Button>
            <div className="flex items-center gap-2 brutalist-border px-3 py-2">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="font-bold text-sm w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
                <ZoomIn className="h-4 w-4" />
              </button>
            </div>
            <button 
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="brutalist-border p-2"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Mindmap Canvas */}
        <div 
          ref={canvasRef}
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Legend */}
          <div className="absolute top-4 left-4 brutalist-border bg-background p-4 z-10">
            <p className="font-black uppercase text-sm mb-3">Legend</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-foreground"></div>
                <span>Government</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-muted-foreground"></div>
                <span>Opposition</span>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-foreground">
                <div className="w-8 h-0.5 bg-green-500"></div>
                <span>Supports</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-red-500"></div>
                <span>Rebuts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-amber-500"></div>
                <span>Clashes</span>
              </div>
            </div>
          </div>

          {/* SVG for relationships */}
          <svg 
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {relationships.map((rel: ArgumentRelationship) => {
              const source = positionedArgs.find(a => a.id === rel.sourceArgumentId);
              const target = positionedArgs.find(a => a.id === rel.targetArgumentId);
              if (!source || !target || !source.x || !source.y || !target.x || !target.y) return null;

              return (
                <g key={rel.id}>
                  <line
                    x1={source.x + 100}
                    y1={source.y + 40}
                    x2={target.x + 100}
                    y2={target.y + 40}
                    stroke={getRelationshipColor(rel.relationshipType)}
                    strokeWidth={2 + (rel.strength || 0.5) * 2}
                    strokeDasharray={rel.relationshipType === "clashes" ? "5,5" : "none"}
                  />
                  {/* Arrow */}
                  <polygon
                    points={`${target.x + 100},${target.y + 40} ${target.x + 90},${target.y + 35} ${target.x + 90},${target.y + 45}`}
                    fill={getRelationshipColor(rel.relationshipType)}
                  />
                </g>
              );
            })}
          </svg>

          {/* Argument Nodes */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {positionedArgs.map((arg) => (
              <div
                key={arg.id}
                className={`absolute w-48 brutalist-border p-3 cursor-pointer transition-all hover:brutalist-shadow ${
                  arg.team === "government" 
                    ? "bg-background hover:bg-foreground hover:text-background" 
                    : "bg-muted hover:bg-muted-foreground hover:text-background"
                } ${selectedNode?.id === arg.id ? "brutalist-shadow ring-4 ring-foreground" : ""}`}
                style={{
                  left: arg.x,
                  top: arg.y,
                }}
                onClick={() => setSelectedNode(arg)}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-black uppercase px-2 py-0.5 ${
                    arg.type === "argument" ? "bg-foreground text-background" :
                    arg.type === "rebuttal" ? "bg-destructive text-destructive-foreground" :
                    "bg-muted-foreground text-background"
                  }`}>
                    {arg.type}
                  </span>
                  {arg.qualityScore !== null && (
                    <span className="text-xs font-bold">
                      {Math.round(arg.qualityScore * 100)}%
                    </span>
                  )}
                </div>
                <p className="text-sm font-bold line-clamp-3">{arg.claim}</p>
                {arg.wasAnswered && (
                  <p className="text-xs mt-2 opacity-70">✓ Answered</p>
                )}
              </div>
            ))}
          </div>

          {/* Empty State */}
          {positionedArgs.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-2xl font-black uppercase mb-2">No Arguments Yet</p>
                <p className="text-muted-foreground">
                  Arguments will appear here after speeches are transcribed and analyzed.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <div className="w-96 border-l-4 border-foreground flex flex-col shrink-0 animate-slide-up">
            <div className="p-4 border-b-4 border-foreground flex items-center justify-between">
              <h3 className="font-black uppercase">Argument Details</h3>
              <button onClick={() => setSelectedNode(null)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-6">
                {/* Type & Team */}
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 font-black uppercase text-sm ${
                    selectedNode.team === "government" 
                      ? "bg-foreground text-background" 
                      : "bg-muted-foreground text-background"
                  }`}>
                    {selectedNode.team}
                  </span>
                  <span className={`px-3 py-1 font-black uppercase text-sm ${
                    selectedNode.type === "argument" ? "bg-muted" :
                    selectedNode.type === "rebuttal" ? "bg-destructive text-destructive-foreground" :
                    "bg-muted"
                  }`}>
                    {selectedNode.type}
                  </span>
                </div>

                {/* Claim */}
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                    Claim
                  </p>
                  <p className="text-lg font-bold">{selectedNode.claim}</p>
                </div>

                {/* Mechanism */}
                {selectedNode.mechanism && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Mechanism
                    </p>
                    <p>{selectedNode.mechanism}</p>
                  </div>
                )}

                {/* Impact */}
                {selectedNode.impact && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Impact
                    </p>
                    <p>{selectedNode.impact}</p>
                  </div>
                )}

                {/* Quality Score */}
                {selectedNode.qualityScore !== null && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Quality Score
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-4 bg-muted">
                        <div 
                          className="h-full bg-foreground"
                          style={{ width: `${selectedNode.qualityScore * 100}%` }}
                        />
                      </div>
                      <span className="font-black text-xl">
                        {Math.round(selectedNode.qualityScore * 100)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Strength */}
                {selectedNode.strengthExplanation && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Strengths
                    </p>
                    <p className="text-green-600">{selectedNode.strengthExplanation}</p>
                  </div>
                )}

                {/* Weakness */}
                {selectedNode.weaknessExplanation && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Weaknesses
                    </p>
                    <p className="text-destructive">{selectedNode.weaknessExplanation}</p>
                  </div>
                )}

                {/* Transcript Excerpt */}
                {selectedNode.transcriptExcerpt && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Transcript Excerpt
                    </p>
                    <blockquote className="brutalist-border-thick border-l-4 border-t-0 border-r-0 border-b-0 pl-4 italic text-muted-foreground">
                      "{selectedNode.transcriptExcerpt}"
                    </blockquote>
                  </div>
                )}

                {/* Status */}
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                    Status
                  </p>
                  <p className={`font-bold ${selectedNode.wasAnswered ? "text-green-600" : "text-amber-600"}`}>
                    {selectedNode.wasAnswered ? "✓ Answered by opponent" : "✗ Not directly addressed"}
                  </p>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </main>
    </div>
  );
}
