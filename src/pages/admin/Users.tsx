import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { 
  Users as UsersIcon, 
  ShieldAlert, 
  Fingerprint, 
  Clock, 
  Search, 
  Filter, 
  RefreshCw, 
  Check, 
  AlertTriangle,
  Mail,
  UserCheck,
  UserMinus
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'super_admin' | 'admin' | 'moderator' | 'editor' | 'user';
  created_at: string;
}

export default function Users() {
  const { profile } = useAuthStore();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  if (profile?.role !== 'super_admin') {
    return (
      <div className="p-8 text-center bg-zinc-950 text-white flex flex-col items-center justify-center min-h-[50vh]">
        <ShieldAlert className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
        <h3 className="text-xl font-bold mb-2">Access Denied</h3>
        <p className="text-zinc-400 max-w-md">Only the Super Admin (<span className="text-red-400 font-semibold font-mono">jobayershuvo1122@gmail.com</span>) has permission to manage users, update authorization settings, or elevate roles.</p>
      </div>
    );
  }

  const fetchUsers = async () => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setUsers(data || []);
    } catch (err: any) {
      console.error('Error fetching profiles:', err);
      setError(err.message || 'Could not fetch profiles from database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateRole = async (userId: string, targetRole: Profile['role']) => {
    if (!supabase) return;
    setError(null);
    
    // Safety check - do not allow demoting self unless confirmed or if it is the designated email
    const currentUserEmail = 'jobayershuvo1122@gmail.com'; 
    const currentProfile = users.find(u => u.id === userId);
    
    if (currentProfile?.email === currentUserEmail && targetRole !== 'super_admin') {
      alert('Security Protection: Demoting the root Super Admin account is blocked to prevent lockouts!');
      return;
    }

    if (!confirm(`Are you sure you want to change this user's role to ${targetRole.replace('_', ' ').toUpperCase()}?`)) {
      return;
    }

    try {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ role: targetRole })
        .eq('id', userId);

      if (updateErr) throw updateErr;

      // Realtime update local list
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: targetRole } : u));
    } catch (err: any) {
      console.error('Error changing role:', err);
      setError(err.message || 'SQL execution failed. Check DB rules.');
    }
  };

  const filteredUsers = users.filter(usr => {
    const matchesSearch = 
      usr.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (usr.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false);

    const matchesRole = 
      roleFilter === 'all' || 
      usr.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  const totalCount = users.length;
  const superAdminCount = users.filter(u => u.role === 'super_admin').length;
  const adminCount = users.filter(u => u.role === 'admin' || u.role === 'editor').length;
  const userCount = users.filter(u => u.role === 'user').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">User Authorization Manager</h2>
          <p className="text-sm text-zinc-400">Review register parameters, elevate users as admins, and monitor site authorization states.</p>
        </div>
        <Button 
          variant="secondary" 
          onClick={fetchUsers} 
          className="flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Reload User Base
        </Button>
      </div>

      {error && (
        <div className="p-6 bg-red-900/10 border border-red-500/20 rounded-xl space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0 animate-pulse" />
            <div>
              <h3 className="font-bold text-white text-sm">Database Setup Required</h3>
              <p className="text-zinc-300 text-xs mt-1 leading-relaxed">
                We encountered an error interacting with the database: <span className="text-red-400 font-semibold font-mono">{error}</span>
              </p>
              {error.toLowerCase().includes('profiles') && (
                <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
                  The database table <code className="text-red-400 font-mono bg-red-500/10 px-1 py-0.5 rounded">public.profiles</code> is missing in your Supabase project. 
                  This is because the database tables have not been fully initiated.
                </p>
              )}
            </div>
          </div>
          {error.toLowerCase().includes('profiles') && (
            <div className="bg-zinc-950 p-4 rounded-lg border border-white/5 space-y-3">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">How to Fix This:</h4>
              <ol className="list-decimal list-inside text-xs text-zinc-350 space-y-2 font-sans">
                <li>Log in to your <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-red-500 hover:underline text-red-400">Supabase Dashboard</a> and open your project.</li>
                <li>Click on the <strong>SQL Editor</strong> tab in the left-hand sidebar (icon with a prompt terminal symbol).</li>
                <li>Click <strong>New query</strong> and paste all the content located in the <code className="text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded font-mono">/supabase/schema.sql</code> file of your codebase.</li>
                <li>Click <strong>Run</strong> at the bottom right. Once executed successfully, reload this website to sync!</li>
              </ol>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium font-sans">Total Profiles</p>
            <p className="text-xl sm:text-2xl font-bold text-white mt-1">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-zinc-800 text-zinc-400 flex items-center justify-center">
            <UsersIcon className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium">Super Admins</p>
            <p className="text-xl sm:text-2xl font-bold text-red-400 mt-1">{superAdminCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-red-500/15 text-red-400 flex items-center justify-center">
            <Fingerprint className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium font-sans">CMS Operators</p>
            <p className="text-xl sm:text-2xl font-bold text-indigo-400 mt-1">{adminCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
        <div className="glass p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 font-medium font-sans">Movie Viewers</p>
            <p className="text-xl sm:text-2xl font-bold text-emerald-400 mt-1">{userCount}</p>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <UserMinus className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Database User Logs */}
      <div className="glass rounded-xl overflow-hidden p-4 sm:p-6 space-y-4">
        {/* Search Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Search user email or personal name..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-zinc-90 w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>
          
          <div className="flex gap-2 items-center">
            <Filter className="w-4 h-4 text-zinc-500 hidden sm:inline" />
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-red-500 min-w-[140px] cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="super_admin">🔑 Super Admin</option>
              <option value="admin">⭐ Admin</option>
              <option value="editor">📝 Editor</option>
              <option value="moderator">🛡️ Moderator</option>
              <option value="user">👤 User</option>
            </select>
          </div>
        </div>

        {/* User listing (Table Desktop, Cards Mobile) */}
        {loading ? (
          <div className="text-center py-12 text-zinc-500 font-mono text-xs">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Connecting User Node Directory...
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="overflow-x-auto rounded-xl border border-white/5 hidden lg:block">
              <table className="w-full text-left text-sm text-zinc-300 border-collapse">
                <thead className="bg-[#1D1D1F] border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
                  <tr>
                    <th className="px-6 py-4">User Meta Detail</th>
                    <th className="px-6 py-4">Registered Email</th>
                    <th className="px-6 py-4">Current Authorization</th>
                    <th className="px-6 py-4">Account Created</th>
                    <th className="px-6 py-4 text-right">Promote Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-black/20">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map(usr => {
                      const isRootAdmin = usr.email === 'jobayershuvo1122@gmail.com';
                      return (
                        <tr key={usr.id} className="card-hover transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center font-bold font-sans">
                                {usr.full_name?.charAt(0).toUpperCase() || usr.email.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-semibold text-zinc-200 block text-xs sm:text-sm">
                                  {usr.full_name || 'No Name Set'}
                                </span>
                                {isRootAdmin && (
                                  <span className="text-[9px] uppercase tracking-wider text-red-500 font-bold bg-red-500/10 px-1 py-0.5 rounded-sm">Account Owner</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-zinc-300">
                            <div className="flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-zinc-500" />
                              <span>{usr.email}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {usr.role === 'super_admin' && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 bg-red-500/10 text-red-400 rounded-full border border-red-500/20">🔑 Super Admin</span>
                              )}
                              {usr.role === 'admin' && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">⭐ Admin</span>
                              )}
                              {usr.role === 'editor' && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">📝 Editor</span>
                              )}
                              {usr.role === 'moderator' && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 bg-purple-500/10 text-purple-400 rounded-full border border-purple-500/20">🛡️ Moderator</span>
                              )}
                              {usr.role === 'user' && (
                                <span className="text-xs font-semibold px-2.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full">👤 Viewer User</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs font-mono text-zinc-500 inline-flex items-center gap-1 mt-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{new Date(usr.created_at).toLocaleDateString()}</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <select
                              value={usr.role}
                              onChange={e => handleUpdateRole(usr.id, e.target.value as any)}
                              disabled={isRootAdmin}
                              className="bg-zinc-950 border border-white/10 rounded px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-red-500 font-sans cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="user">User</option>
                              <option value="editor">Editor</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-zinc-500">
                        No custom profiles loaded in criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="lg:hidden space-y-4">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(usr => {
                  const isRootAdmin = usr.email === 'jobayershuvo1122@gmail.com';
                  return (
                    <div key={usr.id} className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-3 relative card-hover overflow-hidden transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-zinc-800 text-zinc-200 flex items-center justify-center text-xs font-bold font-sans">
                            {usr.full_name?.charAt(0).toUpperCase() || usr.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-zinc-200 text-sm block leading-none">{usr.full_name || 'Anonymous User'}</span>
                            <span className="text-[10px] text-zinc-500 font-mono mt-1 block">{usr.email}</span>
                          </div>
                        </div>

                        {/* Root flag */}
                        {isRootAdmin && (
                          <span className="text-[8px] uppercase tracking-wider text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded-sm">Root</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-zinc-500 block text-[9px] uppercase font-mono">Registry Date</span>
                          <span className="font-mono text-zinc-400">{new Date(usr.created_at).toLocaleDateString()}</span>
                        </div>
                        <div>
                          <span className="text-zinc-500 block text-[9px] uppercase font-mono">Authority</span>
                          {usr.role === 'super_admin' && <span className="text-red-400">🔑 Super Admin</span>}
                          {usr.role === 'admin' && <span className="text-amber-400">⭐ Admin</span>}
                          {usr.role === 'editor' && <span className="text-indigo-400 font-mono">📝 Editor</span>}
                          {usr.role === 'moderator' && <span className="text-purple-400">🛡️ Moderator</span>}
                          {usr.role === 'user' && <span className="text-zinc-500">👤 Standard User</span>}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500">Alter Authorizations</span>
                        <select
                          value={usr.role}
                          onChange={e => handleUpdateRole(usr.id, e.target.value as any)}
                          disabled={isRootAdmin}
                          className="bg-zinc-900 border border-white/10 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-red-500 cursor-pointer disabled:opacity-50"
                        >
                          <option value="user">User</option>
                          <option value="editor">Editor</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-sm text-zinc-500">
                  No registered profiles matched.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
