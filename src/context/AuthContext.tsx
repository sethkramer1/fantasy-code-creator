
import React, { createContext, useState, useEffect, useContext, useMemo } from "react";
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

  // Function to check if the current user is an admin
  const checkIsAdmin = async (): Promise<boolean> => {
    if (!user) {
      setIsAdmin(false);
      return false;
    }

    try {
      console.log("Checking admin status for user:", user.id);
      // Use the has_role function we created in the database
      const { data, error } = await supabase.rpc('has_role', {
        user_id: user.id,
        role: 'admin'
      });

      if (error) {
        console.error("Error checking admin status:", error);
        setIsAdmin(false);
        return false;
      }

      console.log("Admin check result:", data);
      setIsAdmin(!!data);
      return !!data;
    } catch (error) {
      console.error("Unexpected error checking admin role:", error);
      setIsAdmin(false);
      return false;
    }
  };

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log("Getting initial auth session");
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Error getting auth session:", error);
        } else {
          console.log("Initial session retrieved:", !!data.session, 
                     "User ID:", data.session?.user?.id);
        }
        
        setSession(data.session);
        setUser(data.session?.user || null);
        
        // Check admin status after setting user
        if (data.session?.user) {
          await checkIsAdmin();
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
        console.log("Auth state changed:", _event, session?.user?.id);
        setSession(session);
        setUser(session?.user || null);
        
        // Check admin status after auth state change
        if (session?.user) {
          await checkIsAdmin();
        } else {
          setIsAdmin(false);
        }
        
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsAdmin(false);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Use useMemo to prevent unnecessary context re-renders
  const contextValue = useMemo(() => ({
    session,
    user,
    loading,
    signOut,
    isAdmin, 
    checkIsAdmin
  }), [session, user, loading, isAdmin]);

  return (
    <AuthContext.Provider value={contextValue}>
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
