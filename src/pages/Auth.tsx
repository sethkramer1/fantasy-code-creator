import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { FcGoogle } from "react-icons/fc";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Mail, Lock } from "lucide-react";

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Missing fields",
        description: "Please fill in both email and password",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      let result;
      if (isSignUp) {
        result = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/auth",
          }
        });
      } else {
        result = await supabase.auth.signInWithPassword({
          email,
          password,
        });
      }

      const { error } = result;
      if (error) throw error;

      if (isSignUp) {
        toast({
          title: "Account created",
          description: "Please check your email to confirm your account",
        });
      } else {
        toast({
          title: "Success",
          description: "You have been signed in",
        });
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {isSignUp ? "Create your account" : "Sign in to your account"}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Access and manage your designs
          </p>
        </div>
        
        <form onSubmit={handleEmailAuth} className="mt-8 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <Button 
            type="submit"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Processing..." : (isSignUp ? "Create Account" : "Sign In")}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
            </button>
          </div>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-gray-500">Or continue with</span>
          </div>
        </div>

        <Button 
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2"
          variant="outline"
        >
          <FcGoogle size={20} />
          Google
        </Button>
        
        <div className="text-center">
          <Button 
            onClick={() => navigate("/")}
            variant="ghost"
            className="text-sm"
          >
            Return to Home
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
