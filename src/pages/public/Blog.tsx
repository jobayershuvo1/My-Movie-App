import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { PenLine, Clock, ArrowRight, Search as SearchIcon, Feather } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import type { BlogPost } from '../../types/database.types';

interface PostCard extends BlogPost {
  author?: { full_name: string | null; email: string } | null;
}

export default function Blog() {
  const { profile } = useAuthStore();
  const [posts, setPosts] = useState<PostCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  useEffect(() => {
    const fetchPosts = async () => {
      if (!supabase) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*, author:profiles!blog_posts_author_id_fkey(full_name, email)')
          .eq('published', true)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setPosts((data as PostCard[]) || []);
      } catch (err) {
        console.error('Error loading blog posts:', err);
        try {
          const { data } = await supabase!
            .from('blog_posts')
            .select('*')
            .eq('published', true)
            .order('created_at', { ascending: false });
          setPosts((data as PostCard[]) || []);
        } catch (e) {
          console.error(e);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const categories = ['All', ...Array.from(new Set(posts.map(p => p.category || 'General')))];

  const filtered = posts.filter(p => {
    const matchesCategory = activeCategory === 'All' || (p.category || 'General') === activeCategory;
    const matchesQuery =
      p.title.toLowerCase().includes(query.toLowerCase()) ||
      (p.excerpt || '').toLowerCase().includes(query.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const canRequestAuthor = profile && ['user'].includes(profile.role);

  return (
    <div className="flex-1 w-full bg-[#050505] min-h-screen">
      <Helmet>
        <title>Blog | CineVault — Movie News, Reviews & Editorials</title>
        <meta name="description" content="Read the latest movie news, in-depth reviews, editorials, and interviews from the CineVault community of authors." />
      </Helmet>

      <div className="max-w-6xl mx-auto px-4 py-16 space-y-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-2 text-red-500 mb-2">
              <Feather className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">CineVault Blog</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-2">Stories, Reviews &amp; Editorials</h1>
            <p className="text-sm text-zinc-400 max-w-xl">Insights and articles written by our community of movie enthusiasts and authors.</p>
          </div>
          {canRequestAuthor && (
            <Link
              to="/become-author"
              className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors accent-glow shrink-0"
            >
              <PenLine className="w-4 h-4" /> Become an Author
            </Link>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-3 md:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-red-500/15 border-red-500/40 text-red-400 font-semibold'
                    : 'bg-white/5 border-white/5 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative md:w-64">
            <SearchIcon className="w-4 h-4 absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search articles..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="text-center py-20 text-zinc-500 font-mono text-xs">
            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            Loading articles...
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass rounded-xl p-16 text-center text-zinc-500">
            <PenLine className="w-12 h-12 mx-auto mb-4 text-zinc-700" />
            <p className="text-lg font-medium text-zinc-300">No articles found</p>
            <p className="text-sm mt-1">Check back soon for new stories.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(post => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group glass rounded-2xl overflow-hidden flex flex-col card-hover transition-all border border-white/5"
              >
                <div className="h-44 bg-zinc-900 overflow-hidden relative">
                  {post.cover_image ? (
                    <img
                      src={post.cover_image}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      alt={post.title}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-zinc-700">
                      <PenLine className="w-10 h-10" />
                    </div>
                  )}
                  <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider bg-black/60 text-red-400 px-2 py-1 rounded-full backdrop-blur">
                    {post.category || 'General'}
                  </span>
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <h2 className="text-lg font-bold text-white leading-snug mb-2 group-hover:text-red-400 transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3 mb-4">{post.excerpt}</p>
                  )}
                  <div className="mt-auto flex items-center justify-between text-xs text-zinc-500 pt-3 border-t border-white/5">
                    <span className="truncate max-w-[55%]">
                      {post.author?.full_name || post.author?.email?.split('@')[0] || 'CineVault'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(post.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-red-400 group-hover:gap-2 transition-all">
                    Read article <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
