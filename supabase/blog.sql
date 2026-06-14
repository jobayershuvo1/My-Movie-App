-- ==========================================
-- CINEVAULT BLOG MODULE
-- Adds a Blog system on top of the existing schema:
--   * blog_posts        (create / edit / delete posts)
--   * author_requests   ("become an author" applications)
--   * 'author' role     (content creators)
--   * review_author_request() RPC (approve/reject + auto-promote)
--
-- Safe to run multiple times. Execute AFTER schema.sql in the
-- Supabase SQL Editor.
-- ==========================================

-- 1. EXTEND THE ROLE ENUM WITH 'author'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'author'
      AND enumtypid = 'public.user_role'::regtype
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'author';
  END IF;
END$$;

-- ==========================================
-- 2. BLOG POSTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    cover_image TEXT,
    category TEXT DEFAULT 'General',
    tags TEXT[] DEFAULT '{}',
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    published BOOLEAN DEFAULT false,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS blog_posts_author_idx ON public.blog_posts (author_id);
CREATE INDEX IF NOT EXISTS blog_posts_published_idx ON public.blog_posts (published);

-- Keep updated_at fresh (reuses the shared trigger fn from schema.sql)
DROP TRIGGER IF EXISTS update_blog_posts_updated_at ON public.blog_posts;
CREATE TRIGGER update_blog_posts_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- --- Blog post policies ---
DROP POLICY IF EXISTS "Public can view published posts" ON public.blog_posts;
CREATE POLICY "Public can view published posts"
  ON public.blog_posts FOR SELECT
  USING (published = true);

DROP POLICY IF EXISTS "Authors can view own posts" ON public.blog_posts;
CREATE POLICY "Authors can view own posts"
  ON public.blog_posts FOR SELECT
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Staff can view all posts" ON public.blog_posts;
CREATE POLICY "Staff can view all posts"
  ON public.blog_posts FOR SELECT
  USING (public.get_user_role(auth.uid()) IN ('super_admin','admin','moderator','editor'));

-- Authors create/manage ONLY their own posts...
DROP POLICY IF EXISTS "Authors can insert own posts" ON public.blog_posts;
CREATE POLICY "Authors can insert own posts"
  ON public.blog_posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND
    public.get_user_role(auth.uid()) IN ('author','editor','moderator','admin','super_admin')
  );

DROP POLICY IF EXISTS "Authors can update own posts" ON public.blog_posts;
CREATE POLICY "Authors can update own posts"
  ON public.blog_posts FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete own posts" ON public.blog_posts;
CREATE POLICY "Authors can delete own posts"
  ON public.blog_posts FOR DELETE
  USING (auth.uid() = author_id);

-- ...while editorial staff manage every post.
DROP POLICY IF EXISTS "Staff manage all posts" ON public.blog_posts;
CREATE POLICY "Staff manage all posts"
  ON public.blog_posts FOR ALL
  USING (public.get_user_role(auth.uid()) IN ('super_admin','admin','moderator','editor'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('super_admin','admin','moderator','editor'));

-- ==========================================
-- 3. AUTHOR REQUESTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS public.author_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT,
    bio TEXT,
    reason TEXT NOT NULL,
    sample_link TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    review_notes TEXT,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE INDEX IF NOT EXISTS author_requests_user_idx ON public.author_requests (user_id);

ALTER TABLE public.author_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own author requests" ON public.author_requests;
CREATE POLICY "Users can view own author requests"
  ON public.author_requests FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Staff can view all author requests" ON public.author_requests;
CREATE POLICY "Staff can view all author requests"
  ON public.author_requests FOR SELECT
  USING (public.get_user_role(auth.uid()) IN ('super_admin','admin','moderator'));

DROP POLICY IF EXISTS "Users can submit author requests" ON public.author_requests;
CREATE POLICY "Users can submit author requests"
  ON public.author_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 4. REVIEW RPC (approve / reject)
-- Approving promotes a plain 'user' to 'author' and notifies them.
-- SECURITY DEFINER lets staff promote users without a broad
-- profiles-write policy. Self-escalation is impossible because the
-- caller must already be staff.
-- ==========================================
CREATE OR REPLACE FUNCTION public.review_author_request(
    p_request_id UUID,
    p_approve BOOLEAN,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role    public.user_role;
  v_user_id UUID;
BEGIN
  v_role := public.get_user_role(auth.uid());
  IF v_role NOT IN ('super_admin','admin','moderator') THEN
    RAISE EXCEPTION 'Not authorized to review author requests';
  END IF;

  SELECT user_id INTO v_user_id FROM public.author_requests WHERE id = p_request_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Author request not found';
  END IF;

  IF p_approve THEN
    UPDATE public.author_requests
      SET status = 'approved', reviewed_by = auth.uid(), review_notes = p_notes, reviewed_at = now()
      WHERE id = p_request_id;

    -- Promote, but never demote an existing staff member.
    UPDATE public.profiles SET role = 'author'
      WHERE id = v_user_id AND role = 'user';

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_user_id,
      'You are now an Author! ✍️',
      'Congratulations! Your request to become an author has been approved. Head to your dashboard to write and publish blog posts.',
      'general'
    );
  ELSE
    UPDATE public.author_requests
      SET status = 'rejected', reviewed_by = auth.uid(), review_notes = p_notes, reviewed_at = now()
      WHERE id = p_request_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_user_id,
      'Author Request Update',
      'Your request to become an author was not approved at this time.' || COALESCE(' Notes: ' || p_notes, ''),
      'general'
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 5. ACTIVITY LOG TRIGGERS (audit feed)
-- ==========================================
CREATE OR REPLACE FUNCTION public.log_blog_post_actions()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (auth.uid(), 'post_created',
      'Published blog post "' || NEW.title || '"',
      jsonb_build_object('post_id', NEW.id, 'title', NEW.title, 'published', NEW.published));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (auth.uid(), 'post_updated',
      'Updated blog post "' || NEW.title || '"',
      jsonb_build_object('post_id', NEW.id, 'title', NEW.title, 'published', NEW.published));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (auth.uid(), 'post_deleted',
      'Deleted blog post "' || OLD.title || '"',
      jsonb_build_object('post_id', OLD.id, 'title', OLD.title));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_blog_post_actions_log ON public.blog_posts;
CREATE TRIGGER on_blog_post_actions_log
  AFTER INSERT OR UPDATE OR DELETE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.log_blog_post_actions();

CREATE OR REPLACE FUNCTION public.log_author_request_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, details, metadata)
  VALUES (NEW.user_id, 'author_request_created',
    'Applied to become an author',
    jsonb_build_object('request_id', NEW.id, 'email', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_author_request_created_log ON public.author_requests;
CREATE TRIGGER on_author_request_created_log
  AFTER INSERT ON public.author_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_author_request_created();
