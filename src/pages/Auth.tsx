
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { FcGoogle } from "react-icons/fc";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // This useEffect handles the initial auth check and hash fragment processing
  useEffect(() => {
    const checkAuthAndProcessHash = async () => {
      setLoading(true);
      
      try {
        // The URL hash might contain tokens after OAuth sign-in
        if (location.hash) {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            throw error;
          }
          
          if (data?.session) {
            setSession(data.session);
            navigate("/");
            toast({
              title: "Authentication successful",
              description: "You have been signed in",
            });
            return;
          }
        }
        
        // If we don't have a hash or couldn't get a session from the hash,
        // check if the user is already authenticated
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }
        
        if (data.session) {
          setSession(data.session);
          navigate("/");
        }
      } catch (error) {
        console.error("Auth error:", error);
        toast({
          title: "Authentication error",
          description: error.message || "An unexpected error occurred during authentication",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    checkAuthAndProcessHash();
  }, [navigate, location.hash, toast]);

  // Setup auth state change listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.log("Auth state changed:", _event, !!session);
        setSession(session);
        if (session) {
          navigate("/");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth",
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      toast({
        title: "Error signing in",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Sign in to your account
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Continue with Google to access your designs
          </p>
        </div>
        
        <div className="mt-8 space-y-6">
          <Button 
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2"
            variant="outline"
          >
            <FcGoogle size={20} />
            {loading ? "Processing..." : "Continue with Google"}
          </Button>
          
          <div className="flex items-center">
            <Separator className="flex-1" />
            <span className="px-4 text-sm text-gray-500">Or go back</span>
            <Separator className="flex-1" />
          </div>
          
          <Button 
            onClick={() => navigate("/")}
            variant="outline"
            className="w-full"
          >
            Return to Home
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
