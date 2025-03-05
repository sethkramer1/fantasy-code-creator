import React from 'react';
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Navbar } from "@/components/layout/Navbar";
import { TokenUsageHistory } from "@/components/account/TokenUsageHistory";

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <div>
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Please log in to view your account.</p>
            <Button onClick={() => navigate('/auth')}>Log In</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-2xl mx-auto mb-8">
          <CardHeader>
            <CardTitle>Account Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h2 className="text-xl font-semibold">
                  {user.user_metadata?.full_name || 'User'}
                </h2>
                <p className="text-gray-500">{user.email}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-1">Email</h3>
                <p className="text-gray-600">{user.email}</p>
              </div>

              <div>
                <h3 className="font-medium mb-1">Account ID</h3>
                <p className="text-gray-600 font-mono text-sm">{user.id}</p>
              </div>

              <div>
                <h3 className="font-medium mb-1">Created At</h3>
                <p className="text-gray-600">
                  {new Date(user.created_at).toLocaleDateString()}
                </p>
              </div>

              <div className="pt-4">
                <Button variant="destructive" onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Token Usage History Section */}
        <div className="max-w-2xl mx-auto">
          <TokenUsageHistory />
        </div>
      </div>
    </div>
  );
}
