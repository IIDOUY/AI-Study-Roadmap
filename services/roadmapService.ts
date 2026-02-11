
import { supabase } from './supabaseClient';
import { Roadmap, ProjectInvitation } from '../types';

// Helper to ensure profile exists for the current user
export const syncUserProfile = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const updates = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name || '',
    updated_at: new Date().toISOString(),
  };

  // We intentionally ignore the error here if it's a minor conflict, 
  // but this ensures the row exists with current email
  const { error } = await supabase.from('profiles').upsert(updates, { onConflict: 'id' });
  if (error) {
      console.warn('Profile sync warning:', error);
  }
};

export const fetchRoadmaps = async (): Promise<Roadmap[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) return [];

  // 1. Fetch Owned Roadmaps
  const { data: ownedData, error: ownedError } = await supabase
    .from('roadmaps')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (ownedError) {
    console.error('Error fetching owned roadmaps:', ownedError);
    if (ownedError.code === '42P17') {
        throw new Error("Database configuration error: Infinite recursion in policies. Please run the updated SQL script.");
    }
    throw ownedError;
  }

  // 2. Fetch Shared Roadmaps (via project_members)
  let sharedRoadmaps: any[] = [];
  try {
    const { data: memberData, error: memberError } = await supabase
        .from('project_members')
        .select('roadmap_id')
        .eq('user_email', user.email.toLowerCase()) // Ensure case match
        .eq('status', 'accepted'); 

    if (!memberError && memberData && memberData.length > 0) {
        const ids = memberData.map(m => m.roadmap_id);
        const { data: sharedData, error: sharedError } = await supabase
            .from('roadmaps')
            .select('*')
            .in('id', ids)
            .order('created_at', { ascending: false });
        
        if (!sharedError && sharedData) {
            sharedRoadmaps = sharedData;
        }
    }
  } catch (e) {
    console.warn("Shared projects skipped due to configuration or network issue.");
  }

  // Combine and map
  const allData = [...(ownedData || []), ...sharedRoadmaps];
  
  // Remove duplicates
  const uniqueData = Array.from(new Map(allData.map(item => [item.id, item])).values());

  return uniqueData.map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    totalTimeEstimate: row.total_time_estimate,
    modules: row.modules,
    createdAt: row.created_at,
    user_id: row.user_id
  }));
};

// --- Invitation Management ---

export const fetchPendingInvitations = async (): Promise<ProjectInvitation[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) return [];

    try {
        // Fetch invitations, the associated roadmap's basic info, and inviter_id
        const { data, error } = await supabase
            .from('project_members')
            .select(`
                id,
                roadmap_id,
                added_at,
                inviter_id,
                roadmaps ( 
                    title,
                    user_id
                )
            `)
            .ilike('user_email', user.email)
            .eq('status', 'pending');

        if (error) throw error;
        
        // Enrich with sender details and ensure title is found
        const invitations = await Promise.all(data.map(async (d: any) => {
            // 1. Ensure we have the Project Title & Owner ID
            let roadmapTitle = d.roadmaps?.title;
            let ownerId = d.roadmaps?.user_id;

            // Fallback: If join failed (null), explicitly fetch using roadmap_id
            if (!roadmapTitle && d.roadmap_id) {
                const { data: rData } = await supabase
                    .from('roadmaps')
                    .select('title, user_id')
                    .eq('id', d.roadmap_id)
                    .maybeSingle();
                
                if (rData) {
                    roadmapTitle = rData.title;
                    ownerId = rData.user_id;
                }
            }

            // 2. Determine Sender Info
            let sender_name = 'Unknown';
            let sender_email = 'Unknown';

            // Priority A: Check inviter_id (The person who clicked invite)
            if (d.inviter_id) {
                const { data: inviterProfile } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', d.inviter_id)
                    .single();
                
                if (inviterProfile) {
                    sender_name = inviterProfile.full_name || 'Unknown';
                    sender_email = inviterProfile.email || 'Unknown';
                }
            }
            
            // Priority B: Check owner of the roadmap (Fallback)
            if (sender_name === 'Unknown' && ownerId) {
                const { data: ownerProfile } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', ownerId)
                    .single();
                
                if (ownerProfile) {
                    sender_name = ownerProfile.full_name || 'Unknown';
                    sender_email = ownerProfile.email || 'Unknown';
                }
            }

            return {
                id: d.id,
                roadmap_id: d.roadmap_id,
                added_at: d.added_at,
                roadmap_title: roadmapTitle || 'Untitled Project',
                invited_by: sender_name !== 'Unknown' ? sender_name : 'Project Owner',
                sender_name,
                sender_email
            };
        }));
        
        return invitations;
    } catch (e) {
        console.warn("Error fetching invitations", e);
        return [];
    }
};

export const respondToInvitation = async (invitationId: string, accept: boolean): Promise<void> => {
    if (accept) {
        const { error } = await supabase
            .from('project_members')
            .update({ status: 'accepted' })
            .eq('id', invitationId);
            
        if (error) {
            console.error("Accept invite error", error);
            throw error;
        }
    } else {
        const { error } = await supabase
            .from('project_members')
            .delete()
            .eq('id', invitationId);
        if (error) throw error;
    }
};


export const createRoadmap = async (roadmap: Roadmap): Promise<Roadmap> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error("User must be logged in to save roadmap");

  const { data, error } = await supabase
    .from('roadmaps')
    .insert([
      {
        id: roadmap.id,
        title: roadmap.title,
        description: roadmap.description,
        total_time_estimate: roadmap.totalTimeEstimate,
        modules: roadmap.modules,
        created_at: roadmap.createdAt,
        user_id: user.id
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creating roadmap:', error);
    throw error;
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    totalTimeEstimate: data.total_time_estimate,
    modules: data.modules,
    createdAt: data.created_at,
    user_id: data.user_id
  };
};

export const updateRoadmap = async (roadmap: Roadmap): Promise<void> => {
  const { error } = await supabase
    .from('roadmaps')
    .update({
      title: roadmap.title,
      description: roadmap.description,
      modules: roadmap.modules, 
      total_time_estimate: roadmap.totalTimeEstimate
    })
    .eq('id', roadmap.id);

  if (error) {
    console.error('Error updating roadmap:', error);
    throw error;
  }
};

export const deleteRoadmap = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('roadmaps')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting roadmap:', error);
    throw error;
  }
};

// Collaboration Services

export const inviteCollaborator = async (roadmapId: string, email: string): Promise<void> => {
    try {
        const cleanEmail = email.toLowerCase().trim();

        // Check if already exists
        const { data: existing, error: fetchError } = await supabase
            .from('project_members')
            .select('*')
            .eq('roadmap_id', roadmapId)
            .eq('user_email', cleanEmail)
            .single();
        
        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError; 
        if (existing) return;

        // Get current user to set as inviter
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
            .from('project_members')
            .insert([{
                roadmap_id: roadmapId,
                user_email: cleanEmail,
                role: 'editor',
                status: 'pending',
                inviter_id: user?.id // Track who sent the invite
            }]);
        
        if (error) throw error;
    } catch (e) {
        console.error("Invite failed", e);
        throw e;
    }
};

export const getCollaborators = async (roadmapId: string): Promise<{email: string, role: string, status: string}[]> => {
    try {
        const { data, error } = await supabase
            .from('project_members')
            .select('user_email, role, status')
            .eq('roadmap_id', roadmapId);
            
        if (error) {
            if (error.code === '42P01') return [];
            throw error;
        }
        
        return data.map(d => ({ email: d.user_email, role: d.role, status: d.status }));
    } catch (e) {
        console.warn("Failed to get collaborators", e);
        return [];
    }
};

export const removeCollaborator = async (roadmapId: string, email: string): Promise<void> => {
    const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('roadmap_id', roadmapId)
        .eq('user_email', email);
    
    if (error) throw error;
};