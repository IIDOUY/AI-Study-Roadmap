
-- 1. Ensure Profiles Table Exists (Basic shell)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY
);

-- 2. Safely Add ALL Potential Missing Columns (Idempotent)
DO $$
BEGIN
    -- email
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='email') THEN
        ALTER TABLE profiles ADD COLUMN email TEXT;
    END IF;

    -- full_name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='full_name') THEN
        ALTER TABLE profiles ADD COLUMN full_name TEXT;
    END IF;

    -- avatar_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='avatar_url') THEN
        ALTER TABLE profiles ADD COLUMN avatar_url TEXT;
    END IF;

    -- updated_at (This caused the specific error you saw)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='updated_at') THEN
        ALTER TABLE profiles ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;

    -- is_pro
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='is_pro') THEN
        ALTER TABLE profiles ADD COLUMN is_pro BOOLEAN DEFAULT FALSE;
    END IF;

    -- preferences
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='preferences') THEN
        ALTER TABLE profiles ADD COLUMN preferences JSONB DEFAULT '{"darkMode": false, "emailNotifications": true, "focusTimerMinutes": 25}'::jsonb;
    END IF;
END $$;

-- 3. Force schema cache reload
NOTIFY pgrst, 'reload schema';

-- 4. RLS Policies for Profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Users can view all profiles" ON profiles 
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can update own profile" ON profiles 
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 5. Helper Tables for Roadmaps
CREATE TABLE IF NOT EXISTS roadmaps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  total_time_estimate TEXT,
  modules JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  roadmap_id UUID REFERENCES roadmaps(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  role TEXT DEFAULT 'editor',
  added_at TIMESTAMPTZ DEFAULT now(),
  status TEXT DEFAULT 'pending',
  UNIQUE(roadmap_id, user_email)
);

-- Safely add inviter_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_members' AND column_name='inviter_id') THEN
        ALTER TABLE project_members ADD COLUMN inviter_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 6. Helper Functions for Security
-- Checks if user is an ACCEPTED member (Used for Write/Update permissions)
CREATE OR REPLACE FUNCTION check_is_roadmap_member(lookup_roadmap_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM project_members 
    WHERE roadmap_id = lookup_roadmap_id 
    AND LOWER(user_email) = LOWER( (select auth.jwt() ->> 'email') )
    AND status = 'accepted' -- Strict check for editing
  );
END;
$$;

CREATE OR REPLACE FUNCTION check_is_roadmap_owner(lookup_roadmap_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM roadmaps 
    WHERE id = lookup_roadmap_id 
    AND user_id = auth.uid()
  );
END;
$$;

ALTER TABLE roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- 8. Clean up and Re-apply Roadmap Policies
DROP POLICY IF EXISTS "Owners can do everything" ON roadmaps;
DROP POLICY IF EXISTS "Members can view shared roadmaps" ON roadmaps;
DROP POLICY IF EXISTS "Members can update shared roadmaps" ON roadmaps;

-- Owner Policy
CREATE POLICY "Owners can do everything" ON roadmaps
  FOR ALL USING (auth.uid() = user_id);

-- Member VIEW Policy (UPDATED: Allows pending members to see the roadmap so they can see the Title in invites)
CREATE POLICY "Members can view shared roadmaps" ON roadmaps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 
      FROM project_members 
      WHERE roadmap_id = roadmaps.id 
      AND LOWER(user_email) = LOWER( (select auth.jwt() ->> 'email') )
      -- Removed 'status = accepted' restriction to allow pending invites to see title
    )
  );

-- Member UPDATE Policy (Strict: Accepted only)
CREATE POLICY "Members can update shared roadmaps" ON roadmaps
  FOR UPDATE USING (check_is_roadmap_member(id));

-- 9. Clean up and Re-apply Member Policies
DROP POLICY IF EXISTS "View members" ON project_members;
DROP POLICY IF EXISTS "Owners can add members" ON project_members;
DROP POLICY IF EXISTS "Remove members" ON project_members;
DROP POLICY IF EXISTS "Accept invites" ON project_members;

CREATE POLICY "View members" ON project_members
  FOR SELECT USING (
    check_is_roadmap_owner(roadmap_id) OR
    LOWER(user_email) = LOWER( (select auth.jwt() ->> 'email') ) OR 
    check_is_roadmap_member(roadmap_id)
  );

CREATE POLICY "Owners can add members" ON project_members
  FOR INSERT WITH CHECK (check_is_roadmap_owner(roadmap_id));

CREATE POLICY "Remove members" ON project_members
  FOR DELETE USING (
    check_is_roadmap_owner(roadmap_id) OR 
    LOWER(user_email) = LOWER( (select auth.jwt() ->> 'email') )
  );

CREATE POLICY "Accept invites" ON project_members
  FOR UPDATE USING (
    LOWER(user_email) = LOWER( (select auth.jwt() ->> 'email') )
  )
  WITH CHECK (
    LOWER(user_email) = LOWER( (select auth.jwt() ->> 'email') )
  );

-- 10. Sync Function and Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
