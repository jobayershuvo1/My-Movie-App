import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: requests, error: rError } = await supabase.from('movie_requests').select('*');
  console.log('Requests query error:', rError, 'count:', requests?.length);
  if (requests && requests.length > 0) {
    console.log(requests[0]);
  }
}
run();
