-- Search History: free tier (requires login), live
INSERT INTO feature_flags (key, tier, status, label, description, emoji, enabled, sort_order)
VALUES ('search_history', 'free', 'live', 'Search History', 'View and re-run your recent searches', '🕐', true, 14)
ON CONFLICT (key) DO UPDATE SET
  tier = EXCLUDED.tier,
  status = EXCLUDED.status,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  enabled = EXCLUDED.enabled,
  sort_order = EXCLUDED.sort_order;

-- Unlimited Search History: premium tier, live
INSERT INTO feature_flags (key, tier, status, label, description, emoji, enabled, sort_order)
VALUES ('search_history_unlimited', 'premium', 'live', 'Unlimited History', 'Keep your full search history forever', '📚', true, 26)
ON CONFLICT (key) DO UPDATE SET
  tier = EXCLUDED.tier,
  status = EXCLUDED.status,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  enabled = EXCLUDED.enabled,
  sort_order = EXCLUDED.sort_order;
