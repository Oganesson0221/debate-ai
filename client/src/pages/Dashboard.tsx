import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  ArrowRight, Plus, Users, Clock, BarChart3, 
  TrendingUp, Target, MessageSquare, Loader2,
  Calendar, ChevronRight
} from "lucide-react";
import { Link } from "wouter";
import { getLoginUrl } from "@/const";

export default function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();
  
  const { data: debates, isLoading: debatesLoading } = trpc.debate.myDebates.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  
  const { data: metrics, isLoading: metricsLoading } = trpc.metrics.get.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-display mb-6">SIGN IN</h1>
          <p className="text-xl text-muted-foreground mb-8">
            Access your debate history and track your progress.
          </p>
          <a href={getLoginUrl()}>
            <Button className="brutalist-border brutalist-shadow-hover uppercase font-black px-8 py-6 h-auto text-lg">
              Sign In
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-4 border-foreground">
        <div className="container flex items-center justify-between h-20">
          <Link href="/" className="no-underline hover:bg-transparent">
            <span className="text-2xl font-black tracking-tighter uppercase">
              [DEBATE.AI]
            </span>
          </Link>
          <div className="flex items-center gap-6">
            <span className="font-bold">{user?.name || user?.email}</span>
            <Button 
              variant="outline" 
              onClick={() => logout()}
              className="brutalist-border bg-transparent uppercase font-bold text-sm"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h1 className="text-display mb-4">DASHBOARD</h1>
          <p className="text-xl text-muted-foreground">
            Track your progress and manage your debates.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <Link href="/room/create">
            <Card className="brutalist-border brutalist-shadow-hover p-8 cursor-pointer transition-all hover:bg-foreground hover:text-background group">
              <div className="flex items-center justify-between">
                <div>
                  <Plus className="h-10 w-10 mb-4" />
                  <h2 className="text-2xl font-black uppercase mb-2">Create Room</h2>
                  <p className="opacity-70 group-hover:opacity-100">
                    Start a new debate with AI-generated motion
                  </p>
                </div>
                <ArrowRight className="h-8 w-8" />
              </div>
            </Card>
          </Link>
          <Link href="/room/join">
            <Card className="brutalist-border brutalist-shadow-hover p-8 cursor-pointer transition-all hover:bg-foreground hover:text-background group">
              <div className="flex items-center justify-between">
                <div>
                  <Users className="h-10 w-10 mb-4" />
                  <h2 className="text-2xl font-black uppercase mb-2">Join Room</h2>
                  <p className="opacity-70 group-hover:opacity-100">
                    Enter a room code to join an existing debate
                  </p>
                </div>
                <ArrowRight className="h-8 w-8" />
              </div>
            </Card>
          </Link>
        </div>

        {/* Stats Overview */}
        {metrics && (
          <div className="mb-12">
            <h2 className="text-2xl font-black uppercase mb-6">Your Stats</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Card className="brutalist-border p-6">
                <BarChart3 className="h-8 w-8 mb-4 text-muted-foreground" />
                <p className="text-4xl font-black">{metrics.totalDebates}</p>
                <p className="font-bold uppercase text-sm text-muted-foreground">
                  Total Debates
                </p>
              </Card>
              <Card className="brutalist-border p-6">
                <Target className="h-8 w-8 mb-4 text-muted-foreground" />
                <p className="text-4xl font-black">
                  {(metrics.avgOverallPerformance * 100).toFixed(0)}%
                </p>
                <p className="font-bold uppercase text-sm text-muted-foreground">
                  Avg Performance
                </p>
              </Card>
              <Card className="brutalist-border p-6">
                <MessageSquare className="h-8 w-8 mb-4 text-muted-foreground" />
                <p className="text-4xl font-black">
                  {(metrics.avgRebuttalQuality * 100).toFixed(0)}%
                </p>
                <p className="font-bold uppercase text-sm text-muted-foreground">
                  Rebuttal Quality
                </p>
              </Card>
              <Card className="brutalist-border p-6">
                <TrendingUp className="h-8 w-8 mb-4 text-muted-foreground" />
                <p className="text-4xl font-black">
                  {(metrics.avgResponsiveness * 100).toFixed(0)}%
                </p>
                <p className="font-bold uppercase text-sm text-muted-foreground">
                  Responsiveness
                </p>
              </Card>
            </div>
          </div>
        )}

        {/* Detailed Metrics */}
        {metrics && (
          <div className="mb-12">
            <h2 className="text-2xl font-black uppercase mb-6">Performance Breakdown</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { label: "Argument Completeness", value: metrics.avgArgumentCompleteness, desc: "Claim-Mechanism-Impact structure" },
                { label: "Weighing Usage", value: metrics.avgWeighingUsage, desc: "Comparative analysis skills" },
                { label: "Role Fulfillment", value: metrics.avgRoleFulfillment, desc: "Speaker role execution" },
                { label: "Responsiveness", value: metrics.avgResponsiveness, desc: "Engagement with opponent" },
              ].map((metric, idx) => (
                <Card key={idx} className="brutalist-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="font-black uppercase">{metric.label}</p>
                      <p className="text-sm text-muted-foreground">{metric.desc}</p>
                    </div>
                    <p className="text-3xl font-black">{(metric.value * 100).toFixed(0)}%</p>
                  </div>
                  <div className="h-4 bg-muted">
                    <div 
                      className="h-full bg-foreground transition-all"
                      style={{ width: `${metric.value * 100}%` }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Recent Debates */}
        <div>
          <h2 className="text-2xl font-black uppercase mb-6">Recent Debates</h2>
          {debatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : debates && debates.length > 0 ? (
            <div className="space-y-4">
              {debates.slice(0, 10).map((debate) => (
                <Link key={debate.id} href={`/room/${debate.roomCode}`}>
                  <Card className="brutalist-border p-6 cursor-pointer hover:bg-muted transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className="brutalist-border px-4 py-2">
                          <p className="font-black uppercase tracking-wider">
                            {debate.roomCode}
                          </p>
                        </div>
                        <div>
                          <p className="font-bold">
                            {debate.format.replace('_', ' ').toUpperCase()}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {formatDate(debate.createdAt)}
                            </span>
                            <span className={`px-2 py-0.5 font-bold uppercase text-xs ${
                              debate.status === "completed" 
                                ? "bg-foreground text-background" 
                                : debate.status === "in_progress"
                                ? "bg-muted-foreground text-background"
                                : "bg-muted"
                            }`}>
                              {debate.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="h-6 w-6" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="brutalist-border p-12 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-xl font-black uppercase mb-2">No Debates Yet</p>
              <p className="text-muted-foreground mb-6">
                Start your first debate to begin tracking your progress.
              </p>
              <Link href="/room/create">
                <Button className="brutalist-border brutalist-shadow-hover uppercase font-black">
                  Create Your First Room
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
