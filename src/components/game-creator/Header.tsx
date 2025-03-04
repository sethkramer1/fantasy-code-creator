
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { UserCircle } from "lucide-react";

interface HeaderProps {
  title: string;
  description: string;
}

export function Header({ title, description }: HeaderProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate("/auth");
  };

  const handleAccountClick = () => {
    navigate("/account");
  };

  // Debug output to help diagnose authentication issues
  console.log("Header auth state:", { user, loading, userEmail: user?.email, isLoggedIn: !!user });

  return (
    <div className="space-y-1 flex flex-col md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-black">{title}</h1>
        <p className="text-gray-500">{description}</p>
      </div>
      
      <div className="mt-2 md:mt-0">
        {loading ? (
          // Show loading state
          <div className="h-9 w-24 bg-gray-100 animate-pulse rounded-md"></div>
        ) : user ? (
          // User is logged in - show email and account button
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium mr-2 hidden sm:block">
              {user.email}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="flex items-center gap-2"
              onClick={handleAccountClick}
            >
              <UserCircle size={16} />
              <span className="hidden sm:inline">Account</span>
            </Button>
          </div>
        ) : (
          // User is not logged in - show sign in button
          <Button 
            onClick={handleLoginClick}
            size="sm" 
            variant="outline"
            className="flex items-center gap-2"
          >
            <FcGoogle size={16} />
            Sign in
          </Button>
        )}
      </div>
    </div>
  );
}
