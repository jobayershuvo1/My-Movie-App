import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  Search,
  PenLine,
  RefreshCw,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { Button } from '../../components/ui/Button';
import { ConfirmationModal } from '../../components/ui/ConfirmationModal';
import PostEditor from '../../components/admin/PostEditor';
import type { BlogPost } from '../../types/database.types';

interface PostRow extends BlogPost {
  author?: { full_name: string | null; email: string } | null;
}

export default function Posts() {
  const { profile } = useAuthStore();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ isOpen: boolean; postId: string | null; postTitle: string }>({
    isOpen: false,
    postId: null,
    postTitle: '',
  });

  // Authors only manage their own posts; editorial staff manage everything.
  const isStaff = ['super_admin', 'admin', 'moderator', 'editor'].includes(profile?.role || '');

  const fetchPosts = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blog_posts')
        .select('*, author:profiles!blog_posts_author_id_fkey(full_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts((data as PostRow[]) || []);
    } catch (err) {
      console.error('Error loading posts:', err);
      // Fall back to a plain select if the relationship hint is unavailable
      try {
        const { data } = await supabase!.from('blog_posts').select('*').order('created_at', { ascending: false });
        setPosts((data as PostRow[]) || []);
      } catch (e) {
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  const handleTogglePublished = async (id: string, current: boolean) => {
    if (!supabase) return;
    setSyncingId(id);
    try {
      const next = !current;
      const { error } = await supabase.from('blog_posts').update({ published: next }).eq('id', id);
      if (error) throw error;
      setPosts(prev => prev.map(p => (p.id === id ? { ...p, published: next } : p)));
    } catch (err) {
      console.error('Error toggling publish state:', err);
    } finally {
      setSyncingId(null);
    }
  };

  const deletePost = async (id: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase.from('blog_posts').delete().eq('id', id);
      if (error) throw error;
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error('Error deleting post:', err);
    }
  };

  const filteredPosts = posts.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-1">Blog Posts</h2>
          <p className="text-sm text-zinc-400">
            {isStaff ? 'Write, edit, publish, and remove articles across the blog.' : 'Write, edit, and manage your own articles.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by title or category..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-red-500 sm:w-64"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchPosts}
              className="flex items-center justify-center p-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-all cursor-pointer"
              title="Refresh Posts"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <Button
              onClick={() => { setEditingPost(null); setIsEditorOpen(true); }}
              className="gap-2 text-xs sm:text-sm font-bold flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4" /> New Post
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-zinc-500 font-mono text-xs">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-red-500" />
          Loading articles...
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="glass rounded-xl overflow-hidden hidden lg:block">
            <table className="w-full text-left text-sm text-zinc-300 border-collapse">
              <thead className="bg-[#1D1D1F] border-b border-white/5 text-[10px] uppercase tracking-widest text-zinc-400 font-bold">
                <tr>
                  <th className="px-6 py-4">Article</th>
                  <th className="px-6 py-4">Author</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Published</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-black/20">
                {filteredPosts.length > 0 ? (
                  filteredPosts.map(post => (
                    <tr key={post.id} className="card-hover transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-white/5 flex items-center justify-center">
                            {post.cover_image ? (
                              <img src={post.cover_image} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                            ) : (
                              <PenLine className="w-4 h-4 text-zinc-600" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-200 block truncate max-w-[280px]">{post.title}</span>
                            <span className="text-xs text-zinc-500 font-mono mt-0.5 inline-flex items-center gap-1">
                              {post.category || 'General'} • {new Date(post.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-400">
                        {post.author?.full_name || post.author?.email || '—'}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleTogglePublished(post.id, post.published)}
                          disabled={syncingId === post.id}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5 transition-all border ${
                            post.published
                              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                          }`}
                        >
                          {post.published ? <><Eye className="w-3.5 h-3.5" /> Published</> : <><EyeOff className="w-3.5 h-3.5" /> Draft</>}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-zinc-500">
                        {new Date(post.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {post.published && (
                            <Link
                              to={`/blog/${post.slug}`}
                              target="_blank"
                              className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 border border-transparent hover:border-white/5 transition-colors cursor-pointer"
                              title="View live post"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          )}
                          <button
                            onClick={() => { setEditingPost(post); setIsEditorOpen(true); }}
                            className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 border border-transparent hover:border-white/5 transition-colors cursor-pointer"
                            title="Edit post"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmation({ isOpen: true, postId: post.id, postTitle: post.title })}
                            className="p-2 text-rose-500 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 border border-transparent hover:border-rose-500/10 transition-colors cursor-pointer"
                            title="Delete post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 bg-black/5">
                      No posts yet. Click "New Post" to write your first article.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-4">
            {filteredPosts.length > 0 ? (
              filteredPosts.map(post => (
                <div key={post.id} className="p-4 bg-zinc-950 border border-white/5 rounded-xl space-y-3 card-hover transition-all">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 bg-zinc-900 rounded-lg overflow-hidden shrink-0 border border-white/5 flex items-center justify-center">
                      {post.cover_image ? (
                        <img src={post.cover_image} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <PenLine className="w-4 h-4 text-zinc-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-zinc-200 text-sm leading-tight">{post.title}</h4>
                      <p className="text-xs text-zinc-500 font-mono mt-1">
                        {post.category || 'General'} • {new Date(post.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <button
                      onClick={() => handleTogglePublished(post.id, post.published)}
                      disabled={syncingId === post.id}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer flex items-center gap-1 border ${
                        post.published
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                      }`}
                    >
                      {post.published ? 'Published' : 'Draft'}
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingPost(post); setIsEditorOpen(true); }}
                        className="px-2.5 py-1.5 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 font-bold border border-zinc-700/50 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteConfirmation({ isOpen: true, postId: post.id, postTitle: post.title })}
                        className="px-2.5 py-1.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 font-bold border border-rose-500/20 rounded-lg inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-sm text-zinc-500">No posts found.</div>
            )}
          </div>
        </>
      )}

      <PostEditor
        isOpen={isEditorOpen}
        onClose={() => { setIsEditorOpen(false); setEditingPost(null); }}
        onSuccess={fetchPosts}
        postToEdit={editingPost}
      />

      <ConfirmationModal
        isOpen={deleteConfirmation.isOpen}
        title="Delete Blog Post"
        message={`Are you sure you want to permanently delete "${deleteConfirmation.postTitle}"? This action cannot be undone.`}
        confirmText="Delete Post"
        cancelText="Cancel"
        variant="danger"
        onConfirm={() => { if (deleteConfirmation.postId) deletePost(deleteConfirmation.postId); }}
        onCancel={() => setDeleteConfirmation({ isOpen: false, postId: null, postTitle: '' })}
      />
    </div>
  );
}
