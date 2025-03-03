
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { UserCircle, LogOut } from "lucide-react";

interface HeaderProps {
  title: string;
  description: string;
}

export function Header({ title, description }: HeaderProps) {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();

  const handleLoginClick = () => {
    navigate("/auth");
  };

  const handleLogoutClick = async () => {
    await signOut();
    // User will be redirected automatically by the auth state change listener
  };

  return (
    <div className="space-y-1 flex flex-col md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-black">{title}</h1>
        <p className="text-gray-500">{description}</p>
      </div>
      
      <div className="mt-2 md:mt-0">
        {!loading && (
          user ? (
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium mr-2 hidden sm:block">
                {user.email}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex items-center gap-2"
                onClick={handleLogoutClick}
              >
                <UserCircle size={16} />
                <span className="hidden sm:inline">Account</span>
                <LogOut size={16} className="ml-1 text-gray-500" />
              </Button>
            </div>
          ) : (
            <Button 
              onClick={handleLoginClick}
              size="sm" 
              variant="outline"
              className="flex items-center gap-2"
            >
              <FcGoogle size={16} />
              Sign in
            </Button>
          )
        )}
      </div>
    </div>
  );
}
