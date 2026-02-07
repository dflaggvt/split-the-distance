import { supabase } from './supabase';

/**
 * Log an attribution event to console and Supabase attribution_logs table.
 * 
 * Event types:
 * - SESSION_INIT: New session created with source attribution
 * - SHARE_CREATED: User clicked share button
 * - SHARE_CLICK: Visitor arrived from a shared link
 * - SHARE_LOOKUP_FAILED: Share ID not found in database
 * - UTM_DETECTED: UTM parameters found in URL
 * - REFERRER_CLASSIFIED: Referrer URL parsed and classified
 * - ATTRIBUTION_ERROR: Any error in the attribution pipeline
 */
export async function logAttribution(eventType, data = {}) {
  // Console log with [ATTR] prefix
  const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || localStorage.getItem('debug_attr'));
  
  if (isDev) {
    console.log(`[ATTR] ${eventType}`, data);
  }

  // Write to Supabase attribution_logs
  if (!supabase) return;

  try {
    await supabase.from('attribution_logs').insert({
      event_type: eventType,
      session_id: data.sessionId || null,
      share_id: data.shareId || null,
      source: data.source || null,
      source_detail: data.sourceDetail || null,
      referrer_url: data.referrer || null,
      utm_params: data.utm || null,
      metadata: data.metadata || null,
      error_message: data.error || null,
    });
  } catch (err) {
    console.error('[ATTR] Failed to log:', err);
  }
}
