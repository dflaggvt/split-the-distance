-- Treat users who have purchased search credits as premium customers.
-- Existing enterprise users are left untouched.
UPDATE public.user_profiles AS profile
SET
  plan = 'premium',
  updated_at = now()
FROM public.user_search_credits AS credits
WHERE profile.id = credits.user_id
  AND profile.plan = 'free'
  AND credits.lifetime_purchased > 0;
