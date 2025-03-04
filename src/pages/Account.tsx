
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Mail, LogOut, User, ArrowLeft } from "lucide-react";
import { TokenUsageHistory } from "@/components/account/TokenUsageHistory";

const Account = () => {
  const { user, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Redirect to auth page if not logged in
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged out successfully",
        description: "You have been signed out of your account",
      });
      // The auth state change listener in the AuthContext will handle the redirect
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Error signing out",
        description: "There was a problem signing you out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Handle loading state and not authenticated state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading account information...</p>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to auth page via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")} 
            className="mb-4 pl-0 flex items-center gap-2"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Your Account</h1>
          <p className="text-gray-500 mt-1">View and manage your account details</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={18} />
                Profile Information
              </CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Mail size={16} className="text-gray-400" />
                <span className="text-sm font-medium">{user.email}</span>
              </div>
              {user.user_metadata?.full_name && (
                <div className="flex items-center gap-2">
                  <User size={16} className="text-gray-400" />
                  <span className="text-sm font-medium">{user.user_metadata.full_name}</span>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="destructive" 
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2"
              >
                <LogOut size={16} />
                Sign Out
              </Button>
            </CardFooter>
          </Card>
          
          <div className="md:col-span-2">
            <TokenUsageHistory />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;
