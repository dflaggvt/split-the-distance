-- Enable Midpoint Roulette feature flags

-- roulette: anonymous tier, live — free for everyone
UPDATE feature_flags
SET status = 'live', tier = 'anonymous'
WHERE key = 'roulette';

-- roulette_unlimited: premium tier, live — unlimited rolls for paid users
UPDATE feature_flags
SET status = 'live'
WHERE key = 'roulette_unlimited';
