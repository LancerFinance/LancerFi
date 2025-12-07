-- Clear all projects from the database
-- This will cascade delete related records:
-- - escrows (ON DELETE CASCADE)
-- - milestones (ON DELETE CASCADE)
-- - proposals (ON DELETE CASCADE)
-- - work_submissions (ON DELETE CASCADE)

-- Delete all projects
DELETE FROM public.projects;

-- Clear all profiles
DELETE FROM public.profiles;

-- Clear all messages
DELETE FROM public.messages;

