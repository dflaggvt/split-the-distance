-- Add the distance_toggle feature flag (free feature, live immediately)
INSERT INTO feature_flags (key, label, description, tier, status, emoji, sort_order)
VALUES ('distance_toggle', 'Distance Toggle', 'Switch between drive-time and distance-based midpoint', 'anonymous', 'live', '📏', 6)
ON CONFLICT (key) DO NOTHING;

-- Rename date_night → plan_an_outing to match product backlog (Feb 10 decision)
UPDATE feature_flags
SET key = 'plan_an_outing',
    label = 'Plan an Outing',
    emoji = '🗓️',
    description = 'Curated multi-stop itineraries at your midpoint'
WHERE key = 'date_night';
