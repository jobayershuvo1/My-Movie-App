import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: { user } } = await supabase.auth.signInWithPassword({
    email: 'jobayershuvo1122@gmail.com',
    password: 'password' // We will try a test profile instead
  });
  
  // Just try fetching with ANON key (it mimics a normal user)
  const { data, error } = await supabase.from('profiles').select('*').limit(5);
  console.log('Profiles Query Error:', error);
  console.log('Profiles Data:', data);
}
run();
