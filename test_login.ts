import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: { user }, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'jobayershuvo1122@gmail.com',
    password: 'Password123!' // Try to guess if possible? No, we shouldn't.
  });
  console.log('Login err:', authErr);
}
run();
