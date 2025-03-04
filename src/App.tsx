
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "./context/AuthContext";
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

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/play/:gameId" element={<Play />} />
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
    </AuthProvider>
  );
}

export default App;
