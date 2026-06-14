import React, { useEffect, useState } from 'react';
import { X, Check, Loader2, Upload, PenLine, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';
import { Button } from '../ui/Button';
import type { BlogPost } from '../../types/database.types';

interface PostEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  postToEdit?: BlogPost | null;
}

const POST_CATEGORIES = [
  'General', 'News', 'Reviews', 'Tutorials', 'Editorial', 'Interviews', 'Announcements'
];

// Turn a title into a URL-friendly slug
const slugify = (text: string) =>
  text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

export default function PostEditor({ isOpen, onClose, onSuccess, postToEdit }: PostEditorProps) {
  const { profile } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [category, setCategory] = useState('General');
  const [tags, setTags] = useState('');
  const [published, setPublished] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (postToEdit) {
      setTitle(postToEdit.title || '');
      setSlug(postToEdit.slug || '');
      setSlugEdited(true);
      setExcerpt(postToEdit.excerpt || '');
      setContent(postToEdit.content || '');
      setCoverImage(postToEdit.cover_image || '');
      setCategory(postToEdit.category || 'General');
      setTags((postToEdit.tags || []).join(', '));
      setPublished(postToEdit.published);
    } else {
      setTitle('');
      setSlug('');
      setSlugEdited(false);
      setExcerpt('');
      setContent('');
      setCoverImage('');
      setCategory('General');
      setTags('');
      setPublished(true);
    }
  }, [isOpen, postToEdit]);

  if (!isOpen) return null;

  const handleTitleChange = (value: string) => {
    setTitle(value);
    // Auto-generate the slug until the user manually edits it
    if (!slugEdited) setSlug(slugify(value));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!supabase || !files || files.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `blog/${fileName}`;

      const { error: uploadError } = await supabase.storage.from('media').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('media').getPublicUrl(filePath);
      setCoverImage(data.publicUrl);
    } catch (err: any) {
      console.error(err);
      setError(`Upload failed: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !profile) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Your login session expired. Please sign in again.');
        setLoading(false);
        return;
      }

      const finalSlug = (slug.trim() || slugify(title)) +
        // Keep slugs unique for brand new posts to avoid collisions
        (postToEdit ? '' : `-${Math.random().toString(36).substring(2, 6)}`);

      const tagList = tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);

      const postDoc = {
        title: title.trim(),
        slug: postToEdit ? slug.trim() || slugify(title) : finalSlug,
        excerpt: excerpt.trim() || null,
        content,
        cover_image: coverImage.trim() || null,
        category,
        tags: tagList,
        published,
      };

      if (postToEdit) {
        const { error: updErr } = await supabase
          .from('blog_posts')
          .update(postDoc)
          .eq('id', postToEdit.id);
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabase
          .from('blog_posts')
          .insert([{ ...postDoc, author_id: session.user.id }]);
        if (insErr) throw insErr;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      if (err?.code === '23505') {
        setError('That slug is already in use. Please choose a different one.');
      } else {
        setError(err.message || 'An error occurred while saving the post.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-zinc-950 border border-white/5 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center text-red-500">
              <PenLine className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">
                {postToEdit ? 'Edit Blog Post' : 'Write New Blog Post'}
              </h2>
              <p className="text-xs text-zinc-500">
                {postToEdit ? 'Update the article content and publish status.' : 'Compose an article and publish it to the blog.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Post Title *</label>
            <input
              required
              type="text"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50"
              placeholder="e.g. The Top 10 Sci-Fi Films of the Decade"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">URL Slug</label>
              <input
                type="text"
                value={slug}
                onChange={e => { setSlug(slugify(e.target.value)); setSlugEdited(true); }}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-red-500/50"
                placeholder="auto-generated-from-title"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 cursor-pointer"
              >
                {POST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Excerpt / Summary</label>
            <textarea
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50 resize-none"
              placeholder="A short teaser shown on the blog listing cards..."
            />
          </div>

          {/* Cover image */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Cover Image</label>
            <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*" id="post-cover-upload" onChange={handleFileUpload} className="hidden" />
                <label
                  htmlFor="post-cover-upload"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/10 text-red-500 hover:bg-red-600/20 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File
                </label>
                <span className="text-[10px] text-zinc-500 font-mono">Accepts JPG/PNG</span>
              </div>
              <input
                type="text"
                value={coverImage}
                onChange={e => setCoverImage(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-red-500/50"
                placeholder="Or paste an image link directly..."
              />
              {coverImage && (
                <div className="mt-1 w-full h-32 rounded-lg overflow-hidden border border-white/10 bg-zinc-900">
                  <img src={coverImage} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Content *</label>
            <textarea
              required
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={12}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-red-500/50 resize-y font-sans leading-relaxed"
              placeholder="Write your article here. Plain text and line breaks are preserved."
            />
            <p className="text-[10px] text-zinc-500">Tip: separate paragraphs with a blank line.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={e => setTags(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-red-500/50"
              placeholder="Comma separated, e.g. sci-fi, review, 2024"
            />
          </div>

          <label className="flex items-center gap-3 p-3 border border-white/5 rounded-xl bg-white/5 cursor-pointer hover:bg-white/10 transition-colors w-full sm:w-auto">
            <input
              type="checkbox"
              checked={published}
              onChange={e => setPublished(e.target.checked)}
              className="w-4 h-4 accent-red-600 rounded border-white/10 cursor-pointer"
            />
            <div className="flex items-center gap-2">
              {published ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-zinc-500" />}
              <div className="flex flex-col">
                <span className="text-xs font-bold text-white">{published ? 'Published' : 'Draft'}</span>
                <span className="text-[10px] text-zinc-500">{published ? 'Visible on the public blog' : 'Hidden from the public'}</span>
              </div>
            </div>
          </label>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-zinc-950 flex justify-end gap-3 rounded-b-2xl">
          <Button variant="outline" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2 accent-glow">
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin text-white" /> {postToEdit ? 'Updating...' : 'Publishing...'}</>
            ) : (
              <><Check className="w-4 h-4" /> {postToEdit ? 'Update Post' : 'Publish Post'}</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
