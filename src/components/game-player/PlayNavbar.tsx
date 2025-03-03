
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GameActions } from "./GameActions";
import { useAuth } from "@/context/AuthContext";
import { Download, UserCircle } from "lucide-react";

interface PlayNavbarProps {
  gameId: string;
  gameName: string;
  onExport?: () => void;
  onDownload?: () => void;
  onFork?: () => void;
  onShare?: () => void;
  showCodeEditor: boolean;
  onShowCodeEditorChange: (show: boolean) => void;
}

export function PlayNavbar({
  gameId,
  gameName,
  onExport,
  onDownload,
  onFork,
  onShare,
  showCodeEditor,
  onShowCodeEditorChange,
}: PlayNavbarProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleBackClick = () => {
    navigate("/");
  };

  const handleLoginClick = () => {
    navigate("/auth");
  };

  const handleAccountClick = () => {
    navigate("/account");
  };

  return (
    <header className="bg-white border-b border-gray-200 py-2 px-4 flex items-center justify-between">
      <div className="flex items-center">
        <Button
          onClick={handleBackClick}
          variant="ghost"
          size="sm"
          className="mr-4"
        >
          ← Back
        </Button>
        <h1 className="text-lg font-medium text-gray-800 truncate max-w-[200px] sm:max-w-md">
          {gameName || "Untitled Design"}
        </h1>
      </div>

      <div className="flex items-center space-x-2">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 gap-1 text-sm" 
          onClick={onDownload}
        >
          <Download size={14} />
          Download Zip
        </Button>
        
        <GameActions
          currentVersion={undefined}
          showGenerating={false}
          isLatestVersion={true}
          onRevertToVersion={() => Promise.resolve()}
          onExport={onExport}
          onDownload={onDownload}
          onFork={onFork}
          onShare={onShare}
          showCodeEditor={showCodeEditor}
          onShowCodeEditorChange={onShowCodeEditorChange}
        />
        
        {user ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="flex items-center gap-2 ml-2"
            onClick={handleAccountClick}
          >
            <UserCircle size={16} />
            <span className="hidden sm:inline">Account</span>
          </Button>
        ) : (
          <Button 
            onClick={handleLoginClick}
            size="sm" 
            variant="outline"
            className="ml-2"
          >
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
