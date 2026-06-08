-- ==============================================================================
-- 🚨 QUICK FIX: RUN THIS IN SUPABASE SQL EDITOR TO FIX LOGS & REQUESTS
-- ==============================================================================

-- 1. Fix Movie Requests Table & RLS Policies
ALTER TABLE public.movie_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view movie requests" ON public.movie_requests;
CREATE POLICY "Public can view movie requests" 
  ON public.movie_requests FOR SELECT 
  USING (true);

DROP POLICY IF EXISTS "Users can insert own requests" ON public.movie_requests;
CREATE POLICY "Users can insert own requests" 
  ON public.movie_requests FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own requests" ON public.movie_requests;
CREATE POLICY "Users can update own requests" 
  ON public.movie_requests FOR UPDATE 
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- 2. Fix Activity Logs RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view activity logs" 
  ON public.activity_logs FOR SELECT 
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND role IN ('super_admin', 'admin', 'editor', 'moderator')
    )
  );

DROP POLICY IF EXISTS "Anyone can insert activity logs" ON public.activity_logs;
CREATE POLICY "Anyone can insert activity logs" 
  ON public.activity_logs FOR INSERT 
  WITH CHECK (true);


-- 3. Master Trigger for Movie Requests Tracking (This records requests to Live Logs)
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger
DROP TRIGGER IF EXISTS on_movie_request_actions_log ON public.movie_requests;
CREATE TRIGGER on_movie_request_actions_log 
  AFTER INSERT OR UPDATE OF status ON public.movie_requests 
  FOR EACH ROW EXECUTE FUNCTION public.log_movie_request_actions();


-- 4. Insert a test log to verify functionality immediately
INSERT INTO public.activity_logs (user_id, action, details, ip_address)
VALUES (NULL, 'system_update', 'Activity logging system has been successfully reset and activated.', '127.0.0.1');

