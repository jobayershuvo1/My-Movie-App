import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Clock, Tag, User as UserIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { BlogPost as BlogPostType } from '../../types/database.types';

interface FullPost extends BlogPostType {
  author?: { full_name: string | null; email: string; avatar_url: string | null } | null;
}

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<FullPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      if (!supabase || !slug) return;
      setLoading(true);
      setNotFound(false);
      try {
        let { data, error } = await supabase
          .from('blog_posts')
          .select('*, author:profiles!blog_posts_author_id_fkey(full_name, email, avatar_url)')
          .eq('slug', slug)
          .eq('published', true)
          .maybeSingle();

        // Retry without the relationship hint if the join is unavailable
        if (error) {
          const fallback = await supabase
            .from('blog_posts')
            .select('*')
            .eq('slug', slug)
            .eq('published', true)
            .maybeSingle();
          data = fallback.data as FullPost;
        }

        if (!data) {
          setNotFound(true);
        } else {
          setPost(data as FullPost);
          // Best-effort view counter (ignored if RLS blocks it)
          supabase.from('blog_posts').update({ views: (data.views || 0) + 1 }).eq('id', data.id).then(() => {});
        }
      } catch (err) {
        console.error('Error loading post:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
    window.scrollTo(0, 0);
  }, [slug]);

  if (loading) {
    return (
      <div className="flex-1 w-full bg-[#050505] min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="flex-1 w-full bg-[#050505] min-h-screen flex flex-col items-center justify-center text-center px-4">
        <h1 className="text-2xl font-bold text-white mb-2">Article not found</h1>
        <p className="text-zinc-400 mb-6">This post may have been removed or is not published.</p>
        <Link to="/blog" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>
      </div>
    );
  }

  const authorName = post.author?.full_name || post.author?.email?.split('@')[0] || 'CineVault';

  return (
    <div className="flex-1 w-full bg-[#050505] min-h-screen">
      <Helmet>
        <title>{post.title} | CineVault Blog</title>
        <meta name="description" content={post.excerpt || post.title} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt || post.title} />
        {post.cover_image && <meta property="og:image" content={post.cover_image} />}
        <meta property="og:type" content="article" />
      </Helmet>

      <article className="max-w-3xl mx-auto px-4 py-12">
        <Link to="/blog" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> All Articles
        </Link>

        <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full mb-4">
          {post.category || 'General'}
        </span>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white leading-tight mb-5">{post.title}</h1>

        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-400 mb-8 pb-8 border-b border-white/5">
          <span className="inline-flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center overflow-hidden">
              {post.author?.avatar_url ? (
                <img src={post.author.avatar_url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="w-3.5 h-3.5 text-zinc-400" />
              )}
            </span>
            <span className="text-zinc-200 font-medium">{authorName}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {new Date(post.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>

        {post.cover_image && (
          <div className="rounded-2xl overflow-hidden border border-white/5 mb-10">
            <img src={post.cover_image} className="w-full object-cover" alt={post.title} referrerPolicy="no-referrer" />
          </div>
        )}

        {/* Body — preserves paragraph breaks from plain-text content */}
        <div className="prose prose-invert max-w-none space-y-5">
          {post.content.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="text-zinc-300 leading-relaxed whitespace-pre-line text-[15px]">
              {para}
            </p>
          ))}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mt-12 pt-8 border-t border-white/5">
            <Tag className="w-4 h-4 text-zinc-500" />
            {post.tags.map(tag => (
              <span key={tag} className="text-xs text-zinc-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
