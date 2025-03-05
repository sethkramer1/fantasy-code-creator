
// Example team creation function
import { supabase } from "@/integrations/supabase/client";

export async function createTeam(name: string, description?: string) {
  // Get and log the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('Current user:', user); // Check if we have a valid user
  
  if (!user) {
    throw new Error('No authenticated user found');
  }

  const teamData = {
    name,
    description,
    created_by: user.id // Note: removed the optional chaining since we check for user above
  };
  
  console.log('Attempting to create team with data:', teamData);

  const { data, error } = await supabase
    .from('teams')
    .insert(teamData)
    .select()
    .single();

  if (error) {
    console.error('Error creating team:', error);
    throw error;
  }
  
  return data;
}
