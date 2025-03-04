
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';

export function MainNavigation() {
  const { user } = useAuth();
  
  if (!user) {
    return (
      <Button asChild variant="outline" size="sm" className="h-9">
        <Link to="/auth">Sign In</Link>
      </Button>
    );
  }
  
  return (
    <div className="flex items-center gap-4">
      <Link 
        to="/teams" 
        className="text-sm font-medium hover:text-primary transition-colors"
      >
        Teams
      </Link>
      <Link 
        to="/account" 
        className="text-sm font-medium hover:text-primary transition-colors"
      >
        Account
      </Link>
    </div>
  );
}
