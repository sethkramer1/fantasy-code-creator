import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Settings, LogOut, Plus, Home, FolderKanban, Gamepad2 } from "lucide-react";

export function Navbar() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { teamId } = useParams<{ teamId: string }>();

  const isActive = (path: string) => {
    if (path === '/teams') {
      return location.pathname.startsWith('/teams') && !location.pathname.includes('/projects');
    }
    if (path === '/projects') {
      return location.pathname.includes('/projects');
    }
    return location.pathname === path;
  };

  return (
    <nav className="border-b bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {/* Logo */}
            <div
              className="text-lg font-bold mr-6 cursor-pointer bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500"
              onClick={() => navigate('/')}
            >
              Brew.new
            </div>

            {/* Navigation Links */}
            {user && (
              <div className="hidden md:flex space-x-1">
                <Button
                  variant={isActive('/teams') ? "secondary" : "ghost"}
                  className="h-10 px-4"
                  onClick={() => navigate('/teams')}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Teams
                </Button>
                
                {teamId && (
                  <Button
                    variant={isActive('/projects') ? "secondary" : "ghost"}
                    className="h-10 px-4"
                    onClick={() => navigate(`/teams/${teamId}/projects`)}
                  >
                    <FolderKanban className="h-4 w-4 mr-2" />
                    Projects
                  </Button>
                )}
                
                <Button
                  variant={isActive('/account') ? "secondary" : "ghost"}
                  className="h-10 px-4"
                  onClick={() => navigate('/account')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Account
                </Button>
              </div>
            )}
          </div>

          {/* Right side - User menu */}
          <div className="flex items-center">
            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="rounded-full h-10 w-10 p-0">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.user_metadata?.avatar_url} alt={user?.email || "User"} />
                        <AvatarFallback>
                          {user?.email?.charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.email}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.user_metadata?.full_name || "User"}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    
                    {/* Mobile navigation items */}
                    <div className="md:hidden">
                      <DropdownMenuItem onClick={() => navigate('/teams')}>
                        <Users className="h-4 w-4 mr-2" />
                        Teams
                      </DropdownMenuItem>
                      {teamId && (
                        <DropdownMenuItem onClick={() => navigate(`/teams/${teamId}/projects`)}>
                          <FolderKanban className="h-4 w-4 mr-2" />
                          Projects
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                    </div>
                    
                    <DropdownMenuItem onClick={() => navigate('/account')}>
                      <Settings className="h-4 w-4 mr-2" />
                      Account Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Log out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <Button 
                variant="default" 
                onClick={() => navigate('/auth')}
                className="h-10"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
} 