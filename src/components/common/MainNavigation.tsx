import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Home, Users, UserCircle, User, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MainNavigation() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const isActive = (path: string) => {
    return location.pathname === path;
  };
  
  return (
    <nav className="w-full bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-end h-16 items-center gap-4">
          {user ? (
            <Button
              variant="ghost"
              onClick={() => navigate('/account')}
              className="flex items-center gap-2"
            >
              <User className="h-4 w-4" />
              Account
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() => navigate('/auth')}
              className="flex items-center gap-2"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
