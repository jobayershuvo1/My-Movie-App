import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('activity_logs').select('*');
  console.log('Error:', error);
  console.log('Data count:', data?.length);
  if (data?.length) {
    console.log('First log:', data[0]);
  }
}
run();
