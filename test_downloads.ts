import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
        .from('movie_requests')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false });
  console.log('Error:', error);
  console.log('Data count:', data?.length);
  if (data && data.length > 0) {
      console.log('First request:', data[0]);
  }
}
run();
