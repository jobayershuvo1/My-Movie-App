-- Create sequence if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Fix Movie Requests Policies (RLS)
ALTER TABLE movie_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view movie requests" ON movie_requests;
CREATE POLICY "Public can view movie requests" 
  ON movie_requests FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can insert own requests" ON movie_requests;
CREATE POLICY "Users can insert own requests" 
  ON movie_requests FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own requests" ON movie_requests;
CREATE POLICY "Users can update own requests" 
  ON movie_requests FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own requests" ON movie_requests;
CREATE POLICY "Users can delete own requests" 
  ON movie_requests FOR DELETE 
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins have full access to movie requests" ON movie_requests;
CREATE POLICY "Admins have full access to movie requests" 
  ON movie_requests FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'editor')
    )
  );

-- 2. Create Ratings Table
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


-- 3. Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'general',
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


-- 4. Create Activity Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT NOT NULL,
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


-- 5. Automate Logging and Notifications using Triggers
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


CREATE OR REPLACE FUNCTION public.handle_new_published_movie()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.published = true) OR (TG_OP = 'UPDATE' AND OLD.published IS DISTINCT FROM NEW.published AND NEW.published = true) THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NULL, 'New Release: ' || NEW.title || ' 🍿', 'We have just added "' || NEW.title || '" (' || COALESCE(NEW.release_year::text, '') || ') to CineVault. Explore high speed downloads now!', 'new_movie');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_published_movie_inserted ON public.movies;
CREATE TRIGGER on_new_published_movie_inserted
  AFTER INSERT OR UPDATE OF published ON public.movies
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_published_movie();


CREATE OR REPLACE FUNCTION public.log_profile_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, details, metadata)
  VALUES (NEW.id, 'user_registered', 'New account configured for ' || NEW.email || ' (' || COALESCE(NEW.full_name, 'No full name') || ')', jsonb_build_object('email', NEW.email, 'full_name', NEW.full_name, 'role', NEW.role));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_log ON public.profiles;
CREATE TRIGGER on_profile_created_log AFTER INSERT ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_profile_created();


CREATE OR REPLACE FUNCTION public.log_movie_created()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.activity_logs (user_id, action, details, metadata)
  VALUES (auth.uid(), 'movie_created', 'Added movie: "' || NEW.title || '"', jsonb_build_object('movie_id', NEW.id, 'title', NEW.title));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_movie_created_log ON public.movies;
CREATE TRIGGER on_movie_created_log AFTER INSERT ON public.movies FOR EACH ROW EXECUTE FUNCTION public.log_movie_created();


CREATE OR REPLACE FUNCTION public.log_movie_updated_or_deleted()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (auth.uid(), 'movie_updated', 'Updated movie metadata: "' || NEW.title || '"', jsonb_build_object('movie_id', NEW.id, 'title', NEW.title));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (auth.uid(), 'movie_deleted', 'Deleted movie: "' || OLD.title || '"', jsonb_build_object('movie_id', OLD.id, 'title', OLD.title));
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_movie_updated_or_deleted_log ON public.movies;
CREATE TRIGGER on_movie_updated_or_deleted_log AFTER UPDATE OR DELETE ON public.movies FOR EACH ROW EXECUTE FUNCTION public.log_movie_updated_or_deleted();


CREATE OR REPLACE FUNCTION public.log_movie_request_actions()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (NEW.user_id, 'request_created', 'Submitted movie request for "' || NEW.title || '"', jsonb_build_object('request_id', NEW.id, 'title', NEW.title));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activity_logs (user_id, action, details, metadata)
    VALUES (auth.uid(), 'request_status_change', 'Updated status of "' || NEW.title || '" from "' || OLD.status || '" to "' || NEW.status || '"', jsonb_build_object('request_id', NEW.id, 'title', NEW.title, 'old_status', OLD.status, 'new_status', NEW.status));
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_movie_request_actions_log ON public.movie_requests;
CREATE TRIGGER on_movie_request_actions_log AFTER INSERT OR UPDATE OF status ON public.movie_requests FOR EACH ROW EXECUTE FUNCTION public.log_movie_request_actions();
