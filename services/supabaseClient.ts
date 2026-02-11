import { createClient } from '@supabase/supabase-js';

// These should be set in your environment variables
const supabaseUrl = process.env.SUPABASE_URL || 'https://knrsglvgpwousotfdaph.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY || 'sb_publishable_AnQvSlSPpkKTciy7c3AbHQ_l9iCYUm6';

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase URL or Key is missing. Database features will not work.");
}

export const supabase = createClient(supabaseUrl, supabaseKey);