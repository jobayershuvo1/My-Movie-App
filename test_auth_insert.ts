import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: { user }, error: authErr } = await supabase.auth.signUp({
    email: 'test_request_user@example.com',
    password: 'securepassword123'
  });
  console.log('User created:', user?.id, authErr?.message);

  if (!user) {
      const { data: { user: loginUser } } = await supabase.auth.signInWithPassword({
          email: 'test_request_user@example.com',
          password: 'securepassword123'
      });
      if (loginUser) {
          console.log('Signed in as:', loginUser.id);
          testInsert(loginUser.id);
      }
      return;
  }

  testInsert(user.id);

  async function testInsert(userId: string) {
      const { error } = await supabase.from('movie_requests').insert([{
        user_id: userId,
        title: 'Test',
        year: 2024,
        notes: 'test',
        status: 'pending'
      }]);
      console.log('Insert error:', error);
  }
}
run();
