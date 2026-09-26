-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'username', 'user_' || SUBSTRING(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'username'),
    NEW.raw_user_meta_data ->> 'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert default virtual gifts
INSERT INTO public.gifts (name, icon, price, coins_value) VALUES
  ('Rose', '🌹', 1, 1),
  ('Heart', '❤️', 5, 5),
  ('Star', '⭐', 10, 10),
  ('Diamond', '💎', 50, 50),
  ('Crown', '👑', 100, 100),
  ('Rocket', '🚀', 500, 500),
  ('Universe', '🌌', 1000, 1000)
ON CONFLICT DO NOTHING;
