-- Create bookmarks table for user project bookmarks
CREATE TABLE public.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_wallet_address text NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_wallet_address, project_id)
);

-- Create index for faster lookups
CREATE INDEX idx_bookmarks_user_wallet ON public.bookmarks(user_wallet_address);
CREATE INDEX idx_bookmarks_project_id ON public.bookmarks(project_id);

-- Enable RLS on bookmarks table
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for bookmarks
-- Bookmarks are viewable by everyone (application layer enforces user-specific access)
CREATE POLICY "Bookmarks are viewable by everyone" ON public.bookmarks FOR SELECT USING (true);

-- Anyone can create bookmarks (application layer validates wallet address)
CREATE POLICY "Anyone can create bookmarks" ON public.bookmarks FOR INSERT WITH CHECK (true);

-- Anyone can delete bookmarks (application layer validates wallet address)
CREATE POLICY "Anyone can delete bookmarks" ON public.bookmarks FOR DELETE USING (true);

-- Add comment for clarity
COMMENT ON TABLE public.bookmarks IS 'Stores user bookmarks for projects';
COMMENT ON COLUMN public.bookmarks.user_wallet_address IS 'Wallet address of the user who bookmarked the project';
COMMENT ON COLUMN public.bookmarks.project_id IS 'ID of the bookmarked project';

