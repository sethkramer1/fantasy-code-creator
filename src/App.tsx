import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "./context/AuthContext";
import { GenerationProvider } from "./contexts/GenerationContext";
import StreamingWarningBanner from "./components/common/StreamingWarningBanner";
import { useGeneration } from "./contexts/GenerationContext";
import Index from "./pages/Index";
import Play from "./pages/Play";
import Auth from "./pages/Auth";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import Teams from "./pages/Teams";
import TeamDetails from "./pages/TeamDetails";
import TeamProjects from "./pages/TeamProjects";
import ProjectDetails from "./pages/ProjectDetails";
import JoinTeam from "./pages/JoinTeam";

import "./App.css";

// Wrapper component to use the context hook
function AppContent() {
  const { isGenerating } = useGeneration();
  console.log("AppContent rendering, isGenerating:", isGenerating);
  
  return (
    <Router>
      {/* Remove the banner from here - we'll place it in individual components */}
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/play/:id" element={<Play />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/account" element={<Account />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/teams/:teamId" element={<TeamDetails />} />
        <Route path="/teams/:teamId/projects" element={<TeamProjects />} />
        <Route path="/teams/:teamId/projects/:projectId" element={<ProjectDetails />} />
        <Route path="/join-team/:invitationCode" element={<JoinTeam />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <GenerationProvider>
        <AppContent />
      </GenerationProvider>
    </AuthProvider>
  );
}

export default App;
