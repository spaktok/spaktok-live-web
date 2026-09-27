-- Apply through the Supabase SQL editor/migration runner before enabling the live feed.
-- These indexes support descending feed reads and per-user/per-video like lookups.
CREATE INDEX IF NOT EXISTS videos_feed_created_at_idx
  ON public.videos (created_at DESC)
  WHERE is_live = FALSE;

CREATE INDEX IF NOT EXISTS likes_video_user_idx
  ON public.likes (video_id, user_id);

CREATE OR REPLACE FUNCTION public.update_video_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.video_id IS NOT NULL THEN
    UPDATE public.videos
    SET likes_count = GREATEST(COALESCE(likes_count, 0), 0) + 1
    WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.video_id IS NOT NULL THEN
    UPDATE public.videos
    SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0)
    WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS update_video_like_count_after_insert ON public.likes;
CREATE TRIGGER update_video_like_count_after_insert
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_video_like_count();

DROP TRIGGER IF EXISTS update_video_like_count_after_delete ON public.likes;
CREATE TRIGGER update_video_like_count_after_delete
  AFTER DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.update_video_like_count();
