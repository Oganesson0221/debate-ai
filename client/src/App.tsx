import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import CreateRoom from "./pages/CreateRoom";
import JoinRoom from "./pages/JoinRoom";
import DebateRoom from "./pages/DebateRoom";
import DebateFeedback from "./pages/DebateFeedback";
import ArgumentMindmap from "./pages/ArgumentMindmap";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/room/create" component={CreateRoom} />
      <Route path="/room/join" component={JoinRoom} />
      <Route path="/room/:roomCode" component={DebateRoom} />
      <Route path="/room/:roomCode/feedback" component={DebateFeedback} />
      <Route path="/room/:roomCode/mindmap" component={ArgumentMindmap} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
