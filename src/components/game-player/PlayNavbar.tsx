
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

interface PlayNavbarProps {
  children?: React.ReactNode;
}

export function PlayNavbar({ children }: PlayNavbarProps) {
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
