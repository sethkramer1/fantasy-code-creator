import React from 'react';
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Navbar } from "@/components/layout/Navbar";
import { TokenUsageHistory } from "@/components/account/TokenUsageHistory";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
export default function AccountPage() {
  const {
    user,
    signOut
  } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };
  if (!user) {
    return <div>
        <Navbar />
        <div className="container mx-auto py-8 px-4">
          <div className="text-center">
            <p className="text-gray-500 mb-4">Please log in to view your account.</p>
            <Button onClick={() => navigate('/auth')}>Log In</Button>
          </div>
        </div>
      </div>;
  }
  return <div className="min-h-screen bg-gray-50/50">
      <Navbar />
      <div className="container max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">My Account</h1>
          <p className="mt-2 text-sm text-gray-500">Manage your account preferences and information.</p>
        </div>
        
        <div className="grid gap-8 md:grid-cols-3">
          {/* Profile Card */}
          <Card className="md:col-span-1 shadow-sm border-0 bg-white">
            <CardHeader className="pb-0">
              <CardTitle className="text-lg font-medium">Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center text-center pt-4 pb-6">
                <Avatar className="h-24 w-24 mb-4 border-2 border-primary/10">
                  <AvatarImage src={user.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {user.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h2 className="text-xl font-semibold text-gray-900">
                  {user.user_metadata?.full_name || 'User'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">{user.email}</p>
                <Badge variant="outline" className="mt-3 bg-primary/5 text-primary border-0">
                  Active Account
                </Badge>
              </div>
              
              <Separator className="my-4" />
              
              <Button variant="outline" className="w-full mt-2 border-gray-200 text-gray-700 hover:bg-gray-100/80 hover:text-gray-900" onClick={handleSignOut}>
                Sign Out
              </Button>
            </CardContent>
          </Card>
          
          {/* Account Information */}
          <Card className="md:col-span-2 shadow-sm border-0 bg-white">
            <CardHeader className="pb-0">
              <CardTitle className="text-lg font-medium text-center">Account Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center max-w-md mx-auto">
                <div className="w-full bg-gray-50/70 rounded-lg p-6 mb-8 text-center">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Email Address</h3>
                  <p className="text-xl text-gray-900 font-medium">{user.email}</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
                  <Button variant="outline" className="px-8 py-6 h-auto border-gray-200 text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 rounded-full">
                    Change Password
                  </Button>
                  <Button variant="outline" className="px-8 py-6 h-auto border-gray-200 text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 rounded-full">
                    Update Email
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Token Usage History Section */}
        <div className="mt-8">
          <Card className="shadow-sm border-0 bg-white">
            <CardHeader className="pb-0">
              <CardTitle className="text-lg font-medium">Usage History</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <TokenUsageHistory />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>;
}