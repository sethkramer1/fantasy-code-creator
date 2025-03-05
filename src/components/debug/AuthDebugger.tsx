
import React from 'react';
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AuthDebugger() {
  const { user } = useAuth();
  const [authTest, setAuthTest] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);
  
  const testAuth = async () => {
    setLoading(true);
    try {
      // Test authentication state
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      // Test a simple database query
      const { data: testData, error: testError } = await supabase
        .from('teams')
        .select('count(*)')
        .limit(1);
      
      setAuthTest({
        user: userData,
        userError,
        testData,
        testError,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Auth test error:", error);
      setAuthTest({ error });
    } finally {
      setLoading(false);
    }
  };
  
  if (!import.meta.env.DEV) {
    return null;
  }
  
  return (
    <div className="p-4 border rounded bg-gray-50 my-4">
      <div className="flex gap-2 items-center mb-2">
        <h3 className="text-sm font-medium">Auth Debugger</h3>
        <div className={`w-2 h-2 rounded-full ${user ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <span className="text-xs text-gray-500">{user ? 'Authenticated' : 'Not Authenticated'}</span>
      </div>
      
      <Button 
        size="sm" 
        variant="outline" 
        onClick={testAuth} 
        disabled={loading}
      >
        {loading ? 'Testing...' : 'Test Authentication'}
      </Button>
      
      {authTest && (
        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-40">
          {JSON.stringify(authTest, null, 2)}
        </pre>
      )}
    </div>
  );
}
