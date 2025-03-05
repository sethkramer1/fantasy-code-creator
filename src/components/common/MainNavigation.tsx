
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Home, Users, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MainNavigation() {
  const { user } = useAuth();
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  if (!user) {
    return (
      <Button asChild variant="outline" size="sm" className="h-9">
        <Link to="/auth">Sign In</Link>
      </Button>
    );
  }
  
  return (
    <div className="flex items-center gap-3">
      {location.pathname !== '/' && (
        <Link 
          to="/" 
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            isActive('/') 
              ? "bg-black text-white" 
              : "text-gray-700 hover:bg-gray-100"
          )}
        >
          <Home size={16} />
          <span>Home</span>
        </Link>
      )}
      
      <Link 
        to="/teams" 
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive('/teams') 
            ? "bg-black text-white" 
            : "text-gray-700 hover:bg-gray-100"
        )}
      >
        <Users size={16} />
        <span>Teams</span>
      </Link>
      
      <Link 
        to="/account" 
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
          isActive('/account') 
            ? "bg-black text-white" 
            : "text-gray-700 hover:bg-gray-100"
        )}
      >
        <UserCircle size={16} />
        <span>Account</span>
      </Link>
    </div>
  );
}
