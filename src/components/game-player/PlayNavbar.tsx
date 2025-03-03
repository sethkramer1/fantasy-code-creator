
import { Link } from "react-router-dom";
import { ArrowLeft, MessageSquare, Code } from "lucide-react";

interface PlayNavbarProps {
  gameId: string;
  showSidebar: boolean;
  setShowSidebar: (show: boolean) => void;
  children?: React.ReactNode;
}

export function PlayNavbar({
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
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors flex items-center justify-center lg:hidden"
          aria-label="Toggle chat sidebar"
        >
          <MessageSquare size={18} className={showSidebar ? "text-blue-600" : "text-gray-600"} />
        </button>
        {children}
      </div>
    </div>
  );
}
