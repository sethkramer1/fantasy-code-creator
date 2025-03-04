
import React, { createContext, useState, useEffect, useContext, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  checkIsAdmin: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false);

  // Function to check if the current user is an admin, with debouncing
  const checkIsAdmin = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setIsAdmin(false);
      return false;
    }

    // Prevent multiple simultaneous checks
    if (isCheckingAdmin) {
      return isAdmin;
    }

    try {
      setIsCheckingAdmin(true);
      
      // Use the has_role function we created in the database
      const { data, error } = await supabase.rpc('has_role', {
        user_id: user.id,
        role: 'admin'
      });

      if (error) {
        console.error("Error checking admin status:", error);
        return isAdmin; // Return current state instead of setting false
      }

      // Only update state if there's a change to prevent unnecessary renders
      if (!!data !== isAdmin) {
        setIsAdmin(!!data);
      }
      return !!data;
    } catch (error) {
      console.error("Unexpected error checking admin role:", error);
      return isAdmin; // Return current state instead of setting false
    } finally {
      setIsCheckingAdmin(false);
    }
  }, [user, isAdmin, isCheckingAdmin]);

  async function signOut() {
    try {
      await supabase.auth.signOut();
      setIsAdmin(false);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Error getting auth session:", error);
        }
        
        setSession(data.session);
        setUser(data.session?.user || null);
        
        // Check admin status after setting user, but don't wait on it
        if (data.session?.user) {
          checkIsAdmin().catch(console.error);
        }
      } catch (error) {
        console.error("Unexpected error during auth init:", error);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user || null);
        
        // Check admin status after auth state change, but don't wait on it
        if (session?.user) {
          checkIsAdmin().catch(console.error);
        } else {
          setIsAdmin(false);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [checkIsAdmin]);

  // Use memo to stabilize the auth context value
  const authContextValue = useMemo(() => ({
    session,
    user,
    loading,
    signOut,
    isAdmin,
    checkIsAdmin
  }), [session, user, loading, isAdmin, checkIsAdmin]);

  return (
    <AuthContext.Provider value={authContextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
