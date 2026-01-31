import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { trpc } from "@/lib/trpc";
import { 
  ArrowLeft, ArrowRight, Loader2, ZoomIn, ZoomOut, 
  Maximize2, RefreshCw, ChevronRight, X, Brain, 
  MessageSquare, Zap, Target, Plus, Network
} from "lucide-react";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  width?: number;
  height?: number;
}

interface ArgumentRelationship {
  id: number;
  sourceArgumentId: number;
  targetArgumentId: number;
  relationshipType: string;
  strength: number | null;
}

// Demo data for testing when no real arguments exist
const DEMO_ARGUMENTS: ArgumentNode[] = [
  {
    id: 1,
    claim: "Universal Basic Income would reduce poverty and provide economic security",
    mechanism: "Direct cash transfers ensure everyone has a minimum income floor",
    impact: "Millions lifted out of poverty, reduced inequality",
    team: "government",
    type: "argument",
    qualityScore: 0.85,
    strengthExplanation: "Strong empirical backing from pilot programs",
    weaknessExplanation: "Funding mechanism unclear",
    transcriptExcerpt: "We believe that UBI would fundamentally transform our society...",
    wasAnswered: true,
  },
  {
    id: 2,
    claim: "UBI would disincentivize work and harm productivity",
    mechanism: "Guaranteed income removes the necessity to work for survival",
    impact: "Economic output declines, innovation stagnates",
    team: "opposition",
    type: "rebuttal",
    qualityScore: 0.72,
    strengthExplanation: "Addresses core economic concern",
    weaknessExplanation: "Ignores evidence from pilot programs showing minimal work reduction",
    transcriptExcerpt: "The opposition fundamentally misunderstands human motivation...",
    wasAnswered: true,
  },
  {
    id: 3,
    claim: "Automation makes traditional employment models obsolete",
    mechanism: "AI and robotics will eliminate millions of jobs in coming decades",
    impact: "Mass unemployment without safety net alternatives",
    team: "government",
    type: "argument",
    qualityScore: 0.78,
    strengthExplanation: "Forward-looking analysis of technological trends",
    weaknessExplanation: "Timeline of automation impact is uncertain",
    transcriptExcerpt: "Looking at the trajectory of AI development...",
    wasAnswered: false,
  },
  {
    id: 4,
    claim: "Targeted welfare programs are more efficient than universal payments",
    mechanism: "Resources directed to those who need them most",
    impact: "Better outcomes per dollar spent",
    team: "opposition",
    type: "argument",
    qualityScore: 0.68,
    strengthExplanation: "Cost-efficiency argument is compelling",
    weaknessExplanation: "Ignores administrative costs and stigma of means-testing",
    transcriptExcerpt: "Why should we give money to billionaires?",
    wasAnswered: true,
  },
  {
    id: 5,
    claim: "UBI simplifies bureaucracy and reduces administrative waste",
    mechanism: "Single universal program replaces complex welfare system",
    impact: "Lower overhead, faster delivery, reduced errors",
    team: "government",
    type: "extension",
    qualityScore: 0.82,
    strengthExplanation: "Directly addresses opposition's efficiency concern",
    weaknessExplanation: "Transition costs not addressed",
    transcriptExcerpt: "The current system has 126 different programs...",
    wasAnswered: false,
  },
  {
    id: 6,
    claim: "Inflation would erode UBI benefits over time",
    mechanism: "Increased money supply without productivity gains causes price increases",
    impact: "Real purchasing power of UBI diminishes",
    team: "opposition",
    type: "rebuttal",
    qualityScore: 0.65,
    strengthExplanation: "Valid macroeconomic concern",
    weaknessExplanation: "Assumes UBI is funded by money printing rather than redistribution",
    transcriptExcerpt: "Basic economics tells us that...",
    wasAnswered: false,
  },
];

const DEMO_RELATIONSHIPS: ArgumentRelationship[] = [
  { id: 1, sourceArgumentId: 2, targetArgumentId: 1, relationshipType: "rebuts", strength: 0.8 },
  { id: 2, sourceArgumentId: 5, targetArgumentId: 1, relationshipType: "supports", strength: 0.7 },
  { id: 3, sourceArgumentId: 4, targetArgumentId: 1, relationshipType: "clashes", strength: 0.6 },
  { id: 4, sourceArgumentId: 5, targetArgumentId: 4, relationshipType: "rebuts", strength: 0.75 },
  { id: 5, sourceArgumentId: 6, targetArgumentId: 1, relationshipType: "rebuts", strength: 0.5 },
  { id: 6, sourceArgumentId: 3, targetArgumentId: 1, relationshipType: "extends", strength: 0.6 },
];

export default function ArgumentMindmap() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { isAuthenticated } = useAuth();
  
  const [selectedNode, setSelectedNode] = useState<ArgumentNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showDemo, setShowDemo] = useState(true); // Show demo by default for testing
  const canvasRef = useRef<HTMLDivElement>(null);

  // Fetch room data
  const { data: roomData, isLoading } = trpc.debate.getByRoomCode.useQuery(
    { roomCode: roomCode || "" },
    { enabled: !!roomCode }
  );

  // Fetch arguments with auto-refresh
  const { data: argumentData, isLoading: argsLoading, refetch } = trpc.argument.list.useQuery(
    { sessionId: roomData?.session?.id || 0 },
    { 
      enabled: !!roomData?.session?.id,
      refetchInterval: 5000, // Auto-refresh every 5 seconds for real-time updates
    }
  );

  // Analyze clashes mutation
  const analyzeClashes = trpc.argument.analyzeClashes.useMutation({
    onSuccess: () => {
      toast.success("Clash analysis complete!");
      refetch();
    },
    onError: (error) => toast.error(error.message),
  });

  // Calculate node positions with force-directed layout simulation
  const calculatePositions = useCallback((args: ArgumentNode[]): ArgumentNode[] => {
    if (args.length === 0) return [];
    
    const govArgs = args.filter(a => a.team === "government");
    const oppArgs = args.filter(a => a.team === "opposition");
    
    const centerX = 500;
    const startY = 80;
    const nodeSpacing = 180;
    const teamOffset = 280;
    const nodeWidth = 220;
    const nodeHeight = 100;

    // Position government arguments on the left in a vertical layout
    govArgs.forEach((arg, idx) => {
      arg.x = centerX - teamOffset;
      arg.y = startY + idx * nodeSpacing;
      arg.width = nodeWidth;
      arg.height = nodeHeight;
    });

    // Position opposition arguments on the right
    oppArgs.forEach((arg, idx) => {
      arg.x = centerX + teamOffset;
      arg.y = startY + idx * nodeSpacing;
      arg.width = nodeWidth;
      arg.height = nodeHeight;
    });

    return [...govArgs, ...oppArgs];
  }, []);

  // Use demo data if no real arguments exist
  const rawArguments = argumentData?.arguments?.length ? argumentData.arguments : (showDemo ? DEMO_ARGUMENTS : []);
  const rawRelationships = argumentData?.relationships?.length ? argumentData.relationships : (showDemo ? DEMO_RELATIONSHIPS : []);

  const positionedArgs = useMemo(() => 
    calculatePositions(rawArguments as ArgumentNode[]),
    [rawArguments, calculatePositions]
  );

  const relationships = rawRelationships || [];

  // Pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('mindmap-canvas')) {
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

  // Zoom with mouse wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom(z => Math.max(0.3, Math.min(2, z + delta)));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.addEventListener('wheel', handleWheel, { passive: false });
      return () => canvas.removeEventListener('wheel', handleWheel);
    }
  }, [handleWheel]);

  // Get relationship color and style
  const getRelationshipStyle = (type: string) => {
    switch (type) {
      case "supports": return { color: "#22c55e", dash: "none", label: "supports" };
      case "rebuts": return { color: "#ef4444", dash: "none", label: "rebuts" };
      case "clashes": return { color: "#f59e0b", dash: "8,4", label: "clashes" };
      case "extends": return { color: "#3b82f6", dash: "none", label: "extends" };
      default: return { color: "#6b7280", dash: "none", label: "" };
    }
  };

  // Get node color based on team and type
  const getNodeStyle = (arg: ArgumentNode) => {
    const isGov = arg.team === "government";
    const baseColor = isGov ? "bg-slate-900" : "bg-slate-600";
    const borderColor = isGov ? "border-slate-900" : "border-slate-600";
    
    let typeIndicator = "";
    switch (arg.type) {
      case "rebuttal": typeIndicator = "ring-2 ring-red-500"; break;
      case "extension": typeIndicator = "ring-2 ring-blue-500"; break;
      case "poi": typeIndicator = "ring-2 ring-purple-500"; break;
    }
    
    return { baseColor, borderColor, typeIndicator };
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case "argument": return <Target className="h-3 w-3" />;
      case "rebuttal": return <Zap className="h-3 w-3" />;
      case "extension": return <Plus className="h-3 w-3" />;
      case "poi": return <MessageSquare className="h-3 w-3" />;
      default: return <Brain className="h-3 w-3" />;
    }
  };

  // Calculate path for curved arrows
  const calculatePath = (source: ArgumentNode, target: ArgumentNode) => {
    if (!source.x || !source.y || !target.x || !target.y) return "";
    
    const sourceX = source.x + (source.width || 220) / 2;
    const sourceY = source.y + (source.height || 100) / 2;
    const targetX = target.x + (target.width || 220) / 2;
    const targetY = target.y + (target.height || 100) / 2;
    
    // Calculate control points for a curved line
    const midX = (sourceX + targetX) / 2;
    const midY = (sourceY + targetY) / 2;
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    // Curve offset perpendicular to the line
    const curveOffset = Math.min(50, dist * 0.2);
    const perpX = -dy / dist * curveOffset;
    const perpY = dx / dist * curveOffset;
    
    const ctrlX = midX + perpX;
    const ctrlY = midY + perpY;
    
    return `M ${sourceX} ${sourceY} Q ${ctrlX} ${ctrlY} ${targetX} ${targetY}`;
  };

  // Allow viewing mindmap without authentication for demo purposes
  // Real data still requires auth, but demo mode works for everyone

  // Only show loading if we're actually fetching data (not for demo mode)
  if (isLoading && roomCode && roomCode !== 'demo') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading argument map...</p>
        </div>
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
            <div className="flex items-center gap-2">
              <Network className="h-6 w-6" />
              <span className="text-xl font-black tracking-tighter uppercase">
                Argument Mind Map
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Demo Mode Toggle */}
            {positionedArgs.length === 0 && (
              <Button
                onClick={() => setShowDemo(!showDemo)}
                variant="outline"
                className="brutalist-border uppercase font-black text-sm"
              >
                {showDemo ? "Hide Demo" : "Show Demo"}
              </Button>
            )}
            
            <Button
              onClick={() => analyzeClashes.mutate({ sessionId: roomData?.session?.id || 0 })}
              disabled={analyzeClashes.isPending || positionedArgs.length === 0}
              className="brutalist-border uppercase font-black text-sm"
            >
              {analyzeClashes.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              Analyze Clashes
            </Button>
            
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="brutalist-border uppercase font-black text-sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            
            <div className="flex items-center gap-2 brutalist-border px-3 py-2">
              <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}>
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
              onClick={() => { setZoom(1); setPan({ x: 50, y: 50 }); }}
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
          className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing bg-slate-50 mindmap-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Legend */}
          <div className="absolute top-4 left-4 brutalist-border bg-background p-4 z-10 shadow-lg">
            <p className="font-black uppercase text-sm mb-3">Legend</p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-900 rounded"></div>
                <span>Government</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-slate-600 rounded"></div>
                <span>Opposition</span>
              </div>
              <div className="border-t border-foreground my-2 pt-2">
                <p className="font-bold text-xs uppercase mb-2">Argument Types</p>
              </div>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                <span>Argument</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-red-500" />
                <span>Rebuttal</span>
              </div>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-500" />
                <span>Extension</span>
              </div>
              <div className="border-t border-foreground my-2 pt-2">
                <p className="font-bold text-xs uppercase mb-2">Relationships</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-green-500"></div>
                <span>Supports</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-red-500"></div>
                <span>Rebuts</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-amber-500" style={{ borderBottom: "2px dashed #f59e0b" }}></div>
                <span>Clashes</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-blue-500"></div>
                <span>Extends</span>
              </div>
            </div>
          </div>

          {/* Stats Panel */}
          <div className="absolute top-4 right-4 brutalist-border bg-background p-4 z-10 shadow-lg">
            <p className="font-black uppercase text-sm mb-3">Statistics</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <span>Total Arguments:</span>
                <span className="font-bold">{positionedArgs.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Government:</span>
                <span className="font-bold">{positionedArgs.filter(a => a.team === "government").length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Opposition:</span>
                <span className="font-bold">{positionedArgs.filter(a => a.team === "opposition").length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Relationships:</span>
                <span className="font-bold">{relationships.length}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span>Unanswered:</span>
                <span className="font-bold text-amber-600">
                  {positionedArgs.filter(a => !a.wasAnswered).length}
                </span>
              </div>
            </div>
          </div>

          {/* SVG for relationships */}
          <svg 
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: '2000px',
              height: '2000px',
            }}
          >
            <defs>
              {/* Arrow markers for each relationship type */}
              <marker id="arrow-supports" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#22c55e" />
              </marker>
              <marker id="arrow-rebuts" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#ef4444" />
              </marker>
              <marker id="arrow-clashes" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
              </marker>
              <marker id="arrow-extends" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#3b82f6" />
              </marker>
            </defs>
            
            {relationships.map((rel: ArgumentRelationship) => {
              const source = positionedArgs.find(a => a.id === rel.sourceArgumentId);
              const target = positionedArgs.find(a => a.id === rel.targetArgumentId);
              if (!source || !target) return null;

              const style = getRelationshipStyle(rel.relationshipType);
              const path = calculatePath(source, target);

              return (
                <g key={rel.id}>
                  <path
                    d={path}
                    fill="none"
                    stroke={style.color}
                    strokeWidth={2 + (rel.strength || 0.5) * 2}
                    strokeDasharray={style.dash}
                    markerEnd={`url(#arrow-${rel.relationshipType})`}
                    opacity={0.8}
                  />
                </g>
              );
            })}
          </svg>

          {/* Argument Nodes */}
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
            }}
          >
            {/* Team Labels */}
            <div 
              className="absolute font-black uppercase text-lg tracking-wider text-slate-400"
              style={{ left: 220 - 50, top: 20 }}
            >
              Government
            </div>
            <div 
              className="absolute font-black uppercase text-lg tracking-wider text-slate-400"
              style={{ left: 780 - 50, top: 20 }}
            >
              Opposition
            </div>

            {positionedArgs.map((arg) => {
              const nodeStyle = getNodeStyle(arg);
              return (
                <div
                  key={arg.id}
                  className={`absolute w-56 brutalist-border p-4 cursor-pointer transition-all duration-200 hover:shadow-lg ${
                    arg.team === "government" 
                      ? "bg-white hover:bg-slate-50 border-slate-900" 
                      : "bg-white hover:bg-slate-50 border-slate-600"
                  } ${nodeStyle.typeIndicator} ${
                    selectedNode?.id === arg.id ? "ring-4 ring-yellow-400 shadow-xl" : ""
                  }`}
                  style={{
                    left: arg.x,
                    top: arg.y,
                  }}
                  onClick={() => setSelectedNode(arg)}
                >
                  {/* Header with type and score */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-black uppercase rounded flex items-center gap-1 ${
                        arg.team === "government" 
                          ? "bg-slate-900 text-white" 
                          : "bg-slate-600 text-white"
                      }`}>
                        {getTypeIcon(arg.type)}
                        {arg.type}
                      </span>
                    </div>
                    {arg.qualityScore !== null && (
                      <div className={`text-xs font-bold px-2 py-0.5 rounded ${
                        arg.qualityScore >= 0.7 ? "bg-green-100 text-green-700" :
                        arg.qualityScore >= 0.5 ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {Math.round(arg.qualityScore * 100)}%
                      </div>
                    )}
                  </div>
                  
                  {/* Claim */}
                  <p className="text-sm font-bold line-clamp-3 leading-snug">{arg.claim}</p>
                  
                  {/* Status indicator */}
                  <div className="mt-2 flex items-center gap-2">
                    {arg.wasAnswered ? (
                      <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        Answered
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 font-medium flex items-center gap-1">
                        <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                        Unanswered
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {positionedArgs.length === 0 && !showDemo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <Network className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-2xl font-black uppercase mb-2">No Arguments Yet</p>
                <p className="text-muted-foreground mb-4">
                  Arguments will appear here after speeches are transcribed and analyzed.
                  Start a debate and record speeches to see the argument map.
                </p>
                <Button
                  onClick={() => setShowDemo(true)}
                  variant="outline"
                  className="brutalist-border uppercase font-black"
                >
                  <Brain className="h-4 w-4 mr-2" />
                  Show Demo Data
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedNode && (
          <div className="w-96 border-l-4 border-foreground flex flex-col shrink-0 bg-background animate-slide-up">
            <div className="p-4 border-b-4 border-foreground flex items-center justify-between">
              <h3 className="font-black uppercase">Argument Details</h3>
              <button onClick={() => setSelectedNode(null)} className="hover:bg-muted p-1 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-6">
                {/* Type & Team */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 font-black uppercase text-sm rounded ${
                    selectedNode.team === "government" 
                      ? "bg-slate-900 text-white" 
                      : "bg-slate-600 text-white"
                  }`}>
                    {selectedNode.team}
                  </span>
                  <span className={`px-3 py-1 font-black uppercase text-sm rounded flex items-center gap-1 ${
                    selectedNode.type === "argument" ? "bg-muted" :
                    selectedNode.type === "rebuttal" ? "bg-red-100 text-red-700" :
                    selectedNode.type === "extension" ? "bg-blue-100 text-blue-700" :
                    "bg-muted"
                  }`}>
                    {getTypeIcon(selectedNode.type)}
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
                      Mechanism (How/Why)
                    </p>
                    <p className="text-sm">{selectedNode.mechanism}</p>
                  </div>
                )}

                {/* Impact */}
                {selectedNode.impact && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Impact (Why It Matters)
                    </p>
                    <p className="text-sm">{selectedNode.impact}</p>
                  </div>
                )}

                {/* Quality Score */}
                {selectedNode.qualityScore !== null && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Quality Score
                    </p>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            selectedNode.qualityScore >= 0.7 ? "bg-green-500" :
                            selectedNode.qualityScore >= 0.5 ? "bg-yellow-500" :
                            "bg-red-500"
                          }`}
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
                    <p className="text-sm text-green-700 bg-green-50 p-3 rounded border border-green-200">
                      {selectedNode.strengthExplanation}
                    </p>
                  </div>
                )}

                {/* Weakness */}
                {selectedNode.weaknessExplanation && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Weaknesses
                    </p>
                    <p className="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200">
                      {selectedNode.weaknessExplanation}
                    </p>
                  </div>
                )}

                {/* Transcript Excerpt */}
                {selectedNode.transcriptExcerpt && (
                  <div>
                    <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Transcript Excerpt
                    </p>
                    <blockquote className="border-l-4 border-foreground pl-4 italic text-muted-foreground bg-muted/50 p-3 rounded-r">
                      "{selectedNode.transcriptExcerpt}"
                    </blockquote>
                  </div>
                )}

                {/* Status */}
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                    Response Status
                  </p>
                  <div className={`p-3 rounded flex items-center gap-2 ${
                    selectedNode.wasAnswered 
                      ? "bg-green-50 text-green-700 border border-green-200" 
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    <div className={`w-3 h-3 rounded-full ${
                      selectedNode.wasAnswered ? "bg-green-500" : "bg-amber-500 animate-pulse"
                    }`}></div>
                    <span className="font-bold">
                      {selectedNode.wasAnswered ? "Answered by opponent" : "Not directly addressed"}
                    </span>
                  </div>
                </div>

                {/* Related Arguments */}
                <div>
                  <p className="text-sm font-black uppercase tracking-wider text-muted-foreground mb-2">
                    Related Arguments
                  </p>
                  <div className="space-y-2">
                    {relationships
                      .filter((r: ArgumentRelationship) => 
                        r.sourceArgumentId === selectedNode.id || r.targetArgumentId === selectedNode.id
                      )
                      .map((rel: ArgumentRelationship) => {
                        const otherId = rel.sourceArgumentId === selectedNode.id 
                          ? rel.targetArgumentId 
                          : rel.sourceArgumentId;
                        const otherArg = positionedArgs.find(a => a.id === otherId);
                        if (!otherArg) return null;
                        
                        const style = getRelationshipStyle(rel.relationshipType);
                        const isSource = rel.sourceArgumentId === selectedNode.id;
                        
                        return (
                          <div 
                            key={rel.id}
                            className="p-2 border rounded text-sm cursor-pointer hover:bg-muted"
                            onClick={() => setSelectedNode(otherArg)}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: style.color }}
                              ></div>
                              <span className="font-bold capitalize">
                                {isSource ? `${style.label} →` : `← ${style.label} by`}
                              </span>
                              <span className={`text-xs px-1 rounded ${
                                otherArg.team === "government" ? "bg-slate-900 text-white" : "bg-slate-600 text-white"
                              }`}>
                                {otherArg.team.slice(0, 3).toUpperCase()}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {otherArg.claim}
                            </p>
                          </div>
                        );
                      })}
                    {relationships.filter((r: ArgumentRelationship) => 
                      r.sourceArgumentId === selectedNode.id || r.targetArgumentId === selectedNode.id
                    ).length === 0 && (
                      <p className="text-sm text-muted-foreground italic">
                        No relationships found. Click "Analyze Clashes" to discover connections.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </div>
        )}
      </main>
    </div>
  );
}
