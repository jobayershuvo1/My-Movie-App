-- ==========================================
-- CINEVAULT DATABASE SCHEMA
-- Execute this in your Supabase SQL Editor
-- ==========================================

-- 1. ENUMS & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'moderator', 'editor', 'user');
CREATE TYPE link_status AS ENUM ('active', 'broken', 'maintenance');

-- 2. TABLES

-- Profiles (Extends Auth Users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Movies
CREATE TABLE movies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    poster_url TEXT,
    cover_url TEXT,
    trailer_url TEXT,
    release_year INTEGER,
    imdb_rating DECIMAL(3,1),
    runtime INTEGER, -- in minutes
    language TEXT,
    country TEXT,
    download_enabled BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    trending BOOLEAN DEFAULT false,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Categories & Genres
CREATE TABLE categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL DEFAULT 'genre' -- 'genre', 'category'
);

-- Movie Categories (Many-to-Many)
CREATE TABLE movie_categories (
    movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, category_id)
);

-- Download Links
CREATE TABLE download_links (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
    server_name TEXT NOT NULL, -- 'Google Drive', 'Mega', 'MediaFire'
    url TEXT NOT NULL,
    quality TEXT NOT NULL, -- '4K', '1080p', '720p'
    file_size TEXT, -- '2.5 GB'
    status link_status DEFAULT 'active',
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Movie Requests
CREATE TABLE movie_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    year INTEGER,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'fulfilled', 'rejected'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Download Reports
CREATE TABLE download_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    link_id UUID REFERENCES download_links(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    issue_type TEXT NOT NULL, -- 'broken_link', 'wrong_movie', 'low_quality'
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. TRIGGERS

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_movies_updated_at
    BEFORE UPDATE ON movies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (
    new.id, 
    new.email, 
    CASE 
      WHEN new.email = 'jobayershuvo1122@gmail.com' THEN 'super_admin'::user_role
      ELSE 'user'::user_role
    END
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Helper function to select role safely (defines SECURITY DEFINER to bypass RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role SECURITY DEFINER AS $$
DECLARE
  u_role user_role;
BEGIN
  SELECT role INTO u_role FROM public.profiles WHERE id = user_id;
  RETURN COALESCE(u_role, 'user'::user_role);
END;
$$ LANGUAGE plpgsql;

-- 4.1 Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Super Admins can do everything on profiles" ON profiles;
DROP POLICY IF EXISTS "Allow public read access to profiles" ON profiles;
DROP POLICY IF EXISTS "Allow users to update own profile metadata" ON profiles;

CREATE POLICY "Allow public read access to profiles" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Allow users to update own profile metadata"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND 
    role = public.get_user_role(auth.uid()) -- Safe from recursion because get_user_role uses SECURITY DEFINER
  );

CREATE POLICY "Super Admins can do everything on profiles"
  ON profiles FOR ALL
  USING (
    public.get_user_role(auth.uid()) = 'super_admin'::user_role
  );

-- 4.2 Movies Policies
CREATE POLICY "Public can view published movies" 
  ON movies FOR SELECT 
  USING (published = true);

CREATE POLICY "Admins have full access to movies" 
  ON movies FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'editor')
    )
  );

-- 4.3 Download Links Policies
CREATE POLICY "Public can view download links" 
  ON download_links FOR SELECT 
  USING (
    EXISTS (SELECT 1 FROM movies WHERE movies.id = download_links.movie_id AND movies.published = true)
  );

CREATE POLICY "Admins have full access to download_links" 
  ON download_links FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'editor')
    )
  );

-- 4.4 Categories Policies
CREATE POLICY "Public can view categories" 
  ON categories FOR SELECT 
  USING (true);

CREATE POLICY "Admins have full access to categories" 
  ON categories FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'editor')
    )
  );

-- 5. STORAGE BUCKET CONFIGURATION
-- Insert bucket for media
INSERT INTO storage.buckets (id, name, public) VALUES ('media', 'media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to media
CREATE POLICY "Public media access" ON storage.objects FOR SELECT USING (bucket_id = 'media');

-- Allow admins to insert media
CREATE POLICY "Admin media upload" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'media' AND
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND role IN ('super_admin', 'admin', 'editor')
  )
);

-- ==========================================
-- 6. RATINGS & REVIEWS
-- ==========================================
CREATE TABLE IF NOT EXISTS movie_ratings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    movie_id UUID REFERENCES movies(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(movie_id, user_id)
);

ALTER TABLE movie_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to ratings" ON movie_ratings;
CREATE POLICY "Allow public read access to ratings" 
  ON movie_ratings FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to manage own ratings" ON movie_ratings;
CREATE POLICY "Allow authenticated users to manage own ratings" 
  ON movie_ratings FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==========================================
-- 7. REAL-TIME NOTIFICATIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE, -- Null means global/public broadcast notification!
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general', -- 'request_status', 'new_movie', 'general'
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to read own notifications" ON notifications;
CREATE POLICY "Allow users to read own notifications" 
  ON notifications FOR SELECT 
  USING (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Allow users to update own notifications" ON notifications;
CREATE POLICY "Allow users to update own notifications" 
  ON notifications FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can create notifications" ON notifications;
CREATE POLICY "Admins can create notifications" 
  ON notifications FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'moderator', 'editor')
    )
  );

-- ==========================================
-- 8. AUTOMATIC DB TRIGGERS (NOTIFICATIONS)
-- ==========================================

-- Trigger when a movie request's status is changed (approved, fulfilled, rejected)
CREATE OR REPLACE FUNCTION public.handle_request_status_change()
RETURNS trigger AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Movie Request Approved! 🎉'
        WHEN NEW.status = 'fulfilled' THEN 'Movie Uploaded! 🎬'
        WHEN NEW.status = 'rejected' THEN 'Movie Request Closed'
        ELSE 'Request Updated'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Your request for "' || NEW.title || '" has been approved. Our team is fetching it!'
        WHEN NEW.status = 'fulfilled' THEN 'Excellent news! "' || NEW.title || '" is now live and ready for download. Stream or download it now!'
        WHEN NEW.status = 'rejected' THEN 'Sorry, your request for "' || NEW.title || '" was declined. Notes: ' || COALESCE(NEW.notes, 'None')
        ELSE 'Your movie request "' || NEW.title || '" status has updated to: ' || NEW.status
      END,
      'request_status'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_movie_request_status_change ON public.movie_requests;
CREATE TRIGGER on_movie_request_status_change
  AFTER UPDATE OF status ON public.movie_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_request_status_change();


-- Trigger when a movie is newly published/featured to notify all users (broadcast)
CREATE OR REPLACE FUNCTION public.handle_new_published_movie()
RETURNS trigger AS $$
BEGIN
  -- If newly published, or updated to published=true
  IF (TG_OP = 'INSERT' AND NEW.published = true) OR (TG_OP = 'UPDATE' AND OLD.published IS DISTINCT FROM NEW.published AND NEW.published = true) THEN
    -- Broadcast notification (user_id remains NULL)
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NULL,
      'New Release: ' || NEW.title || ' 🍿',
      'We have just added "' || NEW.title || '" (' || COALESCE(NEW.release_year::text, '') || ') to CineVault. Explore high speed downloads now!',
      'new_movie'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_published_movie_inserted ON public.movies;
CREATE TRIGGER on_new_published_movie_inserted
  AFTER INSERT OR UPDATE OF published ON public.movies
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_published_movie();

-- ==========================================
-- 9. SYSTEM ACTIVITY LOG (AUDIT FEED)
-- ==========================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- e.g. 'user_registered', 'movie_created', 'movie_updated', 'movie_deleted', 'request_created', 'request_status_change', 'rating_submitted', 'rating_updated', 'rating_deleted', 'link_click'
    details TEXT NOT NULL, -- Log explanation
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view activity logs" ON activity_logs;
CREATE POLICY "Admins can view activity logs" 
  ON activity_logs FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'editor', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Anyone can insert activity logs" ON activity_logs;
CREATE POLICY "Anyone can insert activity logs" 
  ON activity_logs FOR INSERT 
  WITH CHECK (true);

-- Trigger 9.1: When a User registers
CREATE OR REPLACE FUNCTION public.log_profile_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, details, metadata)
  VALUES (
    NEW.id,
    'user_registered',
    'New account configured for ' || NEW.email || ' (' || COALESCE(NEW.full_name, 'No full name') || ')',
    jsonb_build_object('email', NEW.email, 'full_name', NEW.full_name, 'role', NEW.role)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_log ON public.profiles;
CREATE TRIGGER on_profile_created_log
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_profile_created();

-- Trigger 9.2: When a film page is created
CREATE OR REPLACE FUNCTION public.log_movie_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, details, metadata)
  VALUES (
    auth.uid(),
    'movie_created',
    'Catalog item created for "' || NEW.title || '" (' || COALESCE(NEW.release_year::text, 'N/A') || ')',
    jsonb_build_object('movie_id', NEW.id, 'title', NEW.title)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_movie_created_log ON public.movies;
CREATE TRIGGER on_movie_created_log
  AFTER INSERT ON public.movies
  FOR EACH ROW EXECUTE FUNCTION public.log_movie_created();

-- Trigger 9.3: When a film is modified or wiped
CREATE OR REPLACE FUNCTION public.log_movie_updated_or_deleted()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (
      auth.uid(),
      'movie_updated',
      'Catalog credentials updated for "' || NEW.title || '"',
      jsonb_build_object('movie_id', NEW.id, 'title', NEW.title, 'published', NEW.published)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (
      auth.uid(),
      'movie_deleted',
      'Catalog details for "' || OLD.title || '" were permanently purged from index tables',
      jsonb_build_object('movie_id', OLD.id, 'title', OLD.title)
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_movie_updated_or_deleted_log ON public.movies;
CREATE TRIGGER on_movie_updated_or_deleted_log
  AFTER UPDATE OR DELETE ON public.movies
  FOR EACH ROW EXECUTE FUNCTION public.log_movie_updated_or_deleted();

-- Trigger 9.4: When a Request is handled/status changes
CREATE OR REPLACE FUNCTION public.log_movie_request_actions()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (
      NEW.user_id,
      'request_created',
      'Submitted movie request for "' || NEW.title || '"',
      jsonb_build_object('request_id', NEW.id, 'title', NEW.title)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (
      auth.uid(),
      'request_status_change',
      'A CineVault staff updated status of "' || NEW.title || '" from "' || OLD.status || '" to "' || NEW.status || '"',
      jsonb_build_object('request_id', NEW.id, 'title', NEW.title, 'old_status', OLD.status, 'new_status', NEW.status)
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_movie_request_actions_log ON public.movie_requests;
CREATE TRIGGER on_movie_request_actions_log
  AFTER INSERT OR UPDATE OF status ON public.movie_requests
  FOR EACH ROW EXECUTE FUNCTION public.log_movie_request_actions();

-- Trigger 9.5: When ratings & reviews are posted
CREATE OR REPLACE FUNCTION public.log_movie_rating_actions()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (
      NEW.user_id,
      'rating_submitted',
      'Submitted a rating of ' || NEW.rating || ' stars on movie details',
      jsonb_build_object('movie_id', NEW.movie_id, 'rating', NEW.rating)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (
      NEW.user_id,
      'rating_updated',
      'Recalculated rating to ' || NEW.rating || ' stars',
      jsonb_build_object('movie_id', NEW.movie_id, 'rating', NEW.rating)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (
      OLD.user_id,
      'rating_deleted',
      'Deleted movie rating review feedback link',
      jsonb_build_object('movie_id', OLD.movie_id)
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_movie_rating_actions_log ON public.movie_ratings;
CREATE TRIGGER on_movie_rating_actions_log
  AFTER INSERT OR UPDATE OR DELETE ON public.movie_ratings
  FOR EACH ROW EXECUTE FUNCTION public.log_movie_rating_actions();
