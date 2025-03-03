
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PlayNavbarProps {
  showCode: boolean;
  setShowCode: (show: boolean) => void;
  isLatestVersion: boolean;
  onRevertToVersion: (version: any) => Promise<void>;
  currentVersion: any;
  gameId: string;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  children?: React.ReactNode;
}

export function PlayNavbar({
  showCode,
  setShowCode,
  isLatestVersion,
  onRevertToVersion,
  currentVersion,
  gameId,
  showSidebar,
  setShowSidebar,
  children
}: PlayNavbarProps) {
  return (
    <div className="w-full h-12 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-10 shadow-sm flex-shrink-0">
      <Link to="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors">
        <ArrowLeft size={18} />
        <span className="text-sm font-medium">Back</span>
      </Link>
      
      <div className="flex items-center gap-4">
        {children}
      </div>
    </div>
  );
}
