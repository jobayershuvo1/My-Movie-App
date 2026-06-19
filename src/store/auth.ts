import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

export type UserRole = 'super_admin' | 'admin' | 'moderator' | 'editor' | 'user';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  created_at: string;
}

interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfileState: (updatedProfile: Partial<Profile>) => void;
}

const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL || 'jobayershuvo1122@gmail.com';

async function resolveProfile(session: Session): Promise<Profile | null> {
  if (!supabase) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single();

  if (session.user.email === SUPER_ADMIN_EMAIL && (!profile || profile.role !== 'super_admin')) {
    try {
      const { data: updated } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          email: session.user.email,
          full_name: profile?.full_name || 'Super Admin',
          role: 'super_admin',
        })
        .select('*')
        .single();

      if (updated) return updated as Profile;
    } catch (err) {
      console.error('Error promoting admin user:', err);
    }
    return {
      id: session.user.id,
      email: session.user.email!,
      full_name: profile?.full_name || 'Super Admin',
      avatar_url: profile?.avatar_url || null,
      role: 'super_admin',
      created_at: profile?.created_at || new Date().toISOString()
    };
  }

  return profile as Profile | null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  profile: null,
  isLoading: true,
  initialize: async () => {
    if (!supabase) {
      set({ isLoading: false });
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      if (session?.user) {
        const profile = await resolveProfile(session);
        set({ user: session.user, profile });
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
    } finally {
      set({ isLoading: false });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const profile = await resolveProfile(session);
        set({ user: session.user, profile });
      } else {
        set({ user: null, profile: null });
      }
    });
  },
  signOut: async () => {
    if (supabase) {
      await supabase.auth.signOut();
      set({ user: null, profile: null });
    }
  },
  updateProfileState: (updatedProfile) => {
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...updatedProfile } : null
    }));
  }
}));
