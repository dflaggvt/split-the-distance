import { supabase } from './supabase'
import { detectAttribution, cleanUrlParams, generateShareId, buildShareUrl } from './attribution'
import { logAttribution } from './attributionLogger'

// ============================================
// SESSION MANAGEMENT
// ============================================

let currentSessionId = null
let sessionStartTime = null
let lastActivityTime = null

const SESSION_TIMEOUT_MS = 30 * 60 * 1000
const SESSION_ID_KEY = 'std_session_id'
const SESSION_START_KEY = 'std_session_start'
const SESSION_LAST_ACTIVITY_KEY = 'std_session_last_activity'

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

/**
 * Generate a unique visitor ID (persistent across sessions)
 */
function generateVisitorId() {
  return 'vis_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

/**
 * Get or create visitor ID (persists in localStorage forever)
 */
function getVisitorId() {
  if (typeof window === 'undefined') return null
  
  try {
    let visitorId = localStorage.getItem('std_visitor_id')
    if (!visitorId) {
      visitorId = generateVisitorId()
      localStorage.setItem('std_visitor_id', visitorId)
    }
    return visitorId
  } catch (e) {
    return null
  }
}

function readStoredSession() {
  const storedId = localStorage.getItem(SESSION_ID_KEY) || sessionStorage.getItem(SESSION_ID_KEY)
  const storedStart = localStorage.getItem(SESSION_START_KEY) || sessionStorage.getItem(SESSION_START_KEY)
  const storedLast = localStorage.getItem(SESSION_LAST_ACTIVITY_KEY) || storedStart

  return {
    id: storedId,
    start: Number.parseInt(storedStart || '', 10),
    last: Number.parseInt(storedLast || '', 10),
  }
}

function persistSession(id, start, last) {
  localStorage.setItem(SESSION_ID_KEY, id)
  localStorage.setItem(SESSION_START_KEY, String(start))
  localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(last))

  // Keep these for older helpers that still read sessionStorage directly.
  sessionStorage.setItem(SESSION_ID_KEY, id)
  sessionStorage.setItem(SESSION_START_KEY, String(start))
  sessionStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(last))
}

function getSessionEndPayload(sessionId = currentSessionId, endedAtMs = lastActivityTime || Date.now()) {
  if (!sessionId || !sessionStartTime) return null

  return {
    action: 'end',
    sessionId,
    visitorId: getVisitorId(),
    endedAt: new Date(endedAtMs).toISOString(),
    durationSeconds: Math.max(0, Math.round((endedAtMs - sessionStartTime) / 1000)),
  }
}

function postSessionMetric(payload, { keepalive = false, accessToken = null } = {}) {
  if (typeof window === 'undefined' || !payload) return Promise.resolve()

  const headers = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  return fetch('/api/analytics/session', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    keepalive,
  }).catch((err) => {
    console.warn('[Analytics] Failed to post session metric:', err.message)
  })
}

/**
 * Get the current persistent visitor ID.
 */
export function getCurrentVisitorId() {
  return getVisitorId()
}

/**
 * Get or create session ID (persists for tab lifetime)
 */
function getSessionId() {
  if (typeof window === 'undefined') return null
  
  try {
    const now = Date.now()
    const stored = readStoredSession()
    const hasStoredSession = !!stored.id && !!stored.start
    const isExpired = hasStoredSession && !!stored.last && now - stored.last > SESSION_TIMEOUT_MS

    if (!currentSessionId && hasStoredSession && !isExpired) {
      currentSessionId = stored.id
      sessionStartTime = stored.start
      lastActivityTime = now
      persistSession(currentSessionId, sessionStartTime, lastActivityTime)
      return currentSessionId
    }

    if (!currentSessionId || isExpired) {
      if (isExpired && stored.id) {
        currentSessionId = stored.id
        sessionStartTime = stored.start
        lastActivityTime = stored.last || now
        endSession(lastActivityTime)
      }

      currentSessionId = generateSessionId()
      sessionStartTime = now
      lastActivityTime = now
      persistSession(currentSessionId, sessionStartTime, lastActivityTime)

      // Log new session start
      logSessionStart()
      window.dispatchEvent(new CustomEvent('std:session-started', {
        detail: { sessionId: currentSessionId },
      }))
    } else {
      lastActivityTime = now
      persistSession(currentSessionId, sessionStartTime || now, lastActivityTime)
    }
  } catch {
    if (!currentSessionId) {
      currentSessionId = generateSessionId()
      sessionStartTime = Date.now()
      lastActivityTime = sessionStartTime
      logSessionStart()
    }
  }
  
  return currentSessionId
}

/**
 * Get device type from user agent
 */
function getDeviceType() {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/tablet|ipad|playbook|silk/i.test(ua)) return 'tablet'
  if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return 'mobile'
  return 'desktop'
}

// ============================================
// INTERNAL USER DETECTION
// ============================================

/**
 * Check if the current user is flagged as internal (team/testing).
 * Visit the site with ?_internal=1 to set the flag.
 * Visit with ?_internal=0 to clear it.
 */
function isInternalUser() {
  if (typeof window === 'undefined') return false
  
  try {
    // Check URL param to set/clear flag
    const params = new URLSearchParams(window.location.search)
    if (params.has('_internal')) {
      const val = params.get('_internal')
      if (val === '1' || val === 'true') {
        localStorage.setItem('std_internal', '1')
        // console.log('[STD] Internal user flag SET')
      } else {
        localStorage.removeItem('std_internal')
        // console.log('[STD] Internal user flag CLEARED')
      }
    }
    
    const isInternal = localStorage.getItem('std_internal') === '1'
    return isInternal
  } catch (e) {
    console.warn('[STD] localStorage error:', e)
    return false
  }
}

// Initialize on page load
if (typeof window !== 'undefined') {
  setTimeout(() => {
    isInternalUser()
    getSessionId() // Initialize session
  }, 0)
}

// Export a function to check internal status (for UI display)
export function checkInternalUser() {
  return isInternalUser()
}

/**
 * Get shared route data if visitor arrived from a share link.
 * Returns { fromLat, fromLng, toLat, toLng, fromName, toName } or null.
 */
export function getSharedRouteData() {
  if (typeof window === 'undefined') return null
  
  // Check window global (set by handleShareArrival)
  if (window.__sharedRouteData) return window.__sharedRouteData

  // Fallback: check URL params for from/to coords
  try {
    const params = new URLSearchParams(window.location.search)
    const from = params.get('from')
    const to = params.get('to')
    
    if (from && to) {
      const [fromLat, fromLng] = from.split(',').map(Number)
      const [toLat, toLng] = to.split(',').map(Number)
      
      if (!isNaN(fromLat) && !isNaN(fromLng) && !isNaN(toLat) && !isNaN(toLng)) {
        return { fromLat, fromLng, toLat, toLng, fromName: null, toName: null }
      }
    }
  } catch {}
  
  return null
}

/**
 * Get the current session ID (for components that need it).
 */
export function getCurrentSessionId() {
  return getSessionId()
}

function getPageViewData(pagePath, userId = null) {
  const path = pagePath || (typeof window !== 'undefined' ? window.location.pathname : '/')
  const search = typeof window !== 'undefined' ? window.location.search || null : null

  return {
    session_id: getSessionId(),
    visitor_id: getVisitorId(),
    user_id: userId,
    page_path: path,
    page_url: typeof window !== 'undefined' ? window.location.href : null,
    search,
    title: typeof document !== 'undefined' ? document.title : null,
    referrer: typeof document !== 'undefined' ? document.referrer : null,
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    device_type: getDeviceType(),
    screen_width: typeof window !== 'undefined' ? window.innerWidth : null,
    screen_height: typeof window !== 'undefined' ? window.innerHeight : null,
    is_internal: isInternalUser(),
  }
}

/**
 * Associate the current anonymous browser session with an authenticated user.
 */
export async function associateCurrentSessionUser(userId, accessToken = null) {
  if (!userId) return

  const sessionId = getSessionId()
  const visitorId = getVisitorId()
  if (!sessionId || !visitorId) return

  const payload = { action: 'associate', sessionId, visitorId, userId }
  await postSessionMetric(payload, { accessToken })

  // Session creation can still be in flight during initial auth hydration.
  setTimeout(() => {
    postSessionMetric(payload, { accessToken })
  }, 750)
}

/**
 * Check if we're on the production domain
 */
function isProductionDomain() {
  if (typeof window === 'undefined') return false
  const hostname = window.location.hostname
  return hostname === 'splitthedistance.com' || hostname === 'www.splitthedistance.com'
}

// ============================================
// GA4 / GTM TRACKING
// ============================================

/**
 * Send event to Google Analytics 4 / GTM
 * Only tracks on production domain (not preview URLs)
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') {
    // console.log('[STD] gtag not available, skipping event:', eventName, params)
    return
  }
  if (!isProductionDomain()) {
    // console.log('[STD] Preview/dev site, skipping GA event:', eventName, params)
    return
  }
  if (isInternalUser()) {
    // console.log('[STD] Internal user, skipping GA event:', eventName, params)
    return
  }
  
  try {
    window.gtag('event', eventName, params)
    // console.log('[STD] GA4 event sent:', eventName, params)
  } catch (err) {
    console.error('GA4 tracking error:', err)
  }
}

// ============================================
// SESSION TRACKING
// ============================================

/**
 * Log session start with attribution detection (called once when session is created)
 */
async function logSessionStart() {
  if (!supabase) return
  
  try {
    // Detect attribution source
    const attr = detectAttribution()
    
    const sessionData = {
      session_id: currentSessionId,
      visitor_id: getVisitorId(),
      started_at: new Date().toISOString(),
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      device_type: getDeviceType(),
      is_internal: isInternalUser(),
    }

    // Add attribution data if detected
    if (attr) {
      sessionData.source = attr.source
      sessionData.source_detail = attr.sourceDetail
      sessionData.utm_source = attr.utm?.utm_source || null
      sessionData.utm_medium = attr.utm?.utm_medium || null
      sessionData.utm_campaign = attr.utm?.utm_campaign || null
      sessionData.utm_content = attr.utm?.utm_content || null
      sessionData.utm_term = attr.utm?.utm_term || null
      sessionData.referrer_url = attr.referrer || null
      sessionData.referrer_domain = attr.referrerDomain || null
      sessionData.landing_page = attr.landingPage || null
    }

    await supabase.from('sessions').insert(sessionData)

    // Log attribution event
    await logAttribution('SESSION_INIT', {
      sessionId: currentSessionId,
      source: attr?.source,
      sourceDetail: attr?.sourceDetail,
      referrer: attr?.referrer,
      utm: attr?.utm,
      metadata: { landingPage: attr?.landingPage, deviceType: getDeviceType() },
    })

    // Handle share link arrival
    if (attr?.shareId) {
      await handleShareArrival(attr.shareId, currentSessionId)
    }

    // Log UTM if detected
    if (attr?.utm?.utm_source || attr?.utm?.utm_medium) {
      await logAttribution('UTM_DETECTED', {
        sessionId: currentSessionId,
        utm: attr.utm,
      })
    }

    // Log referrer classification
    if (attr?.referrer) {
      await logAttribution('REFERRER_CLASSIFIED', {
        sessionId: currentSessionId,
        referrer: attr.referrer,
        source: attr.source,
        sourceDetail: attr.sourceDetail,
      })
    }

    // Clean attribution params from URL bar
    cleanUrlParams()

  } catch (err) {
    console.error('Failed to log session start:', err)
    await logAttribution('ATTRIBUTION_ERROR', {
      sessionId: currentSessionId,
      error: err.message,
      metadata: { phase: 'session_init' },
    })
  }
}

/**
 * Handle arrival from a shared link.
 * Logs share click, increments click count, returns share data for route loading.
 */
async function handleShareArrival(shareId, sessionId) {
  if (!supabase) return null

  try {
    // Look up share in database
    const { data: shareData, error } = await supabase
      .from('shares')
      .select('*')
      .eq('share_id', shareId)
      .single()

    if (error || !shareData) {
      await logAttribution('SHARE_LOOKUP_FAILED', {
        shareId,
        sessionId,
        error: error?.message || 'Share not found',
        metadata: { fallback: 'using_url_coords' },
      })
      return null
    }

    // Log share click — inherit internal flag from the original share or current user
    await supabase.from('share_clicks').insert({
      share_id: shareId,
      visitor_session_id: sessionId,
      referrer_url: document.referrer || null,
      referrer_domain: document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : null,
      device_type: getDeviceType(),
      user_agent: navigator.userAgent,
      is_internal: shareData.is_internal || isInternalUser(),
    })

    // Atomically increment click count (avoids race condition)
    const { error: rpcError } = await supabase.rpc('increment_share_clicks', { p_share_id: shareId })
    if (rpcError) {
      // Fallback if RPC doesn't exist — non-atomic but functional
      await supabase.from('shares')
        .update({ click_count: (shareData.click_count || 0) + 1 })
        .eq('share_id', shareId)
    }

    await logAttribution('SHARE_CLICK', {
      shareId,
      sessionId,
      source: 'share',
      sourceDetail: shareId,
      metadata: {
        sharerSessionId: shareData.session_id,
        route: `${shareData.route_from_name} → ${shareData.route_to_name}`,
      },
    })

    // Store share data for route auto-loading
    if (typeof window !== 'undefined') {
      window.__sharedRouteData = {
        fromLat: shareData.route_from_lat,
        fromLng: shareData.route_from_lng,
        toLat: shareData.route_to_lat,
        toLng: shareData.route_to_lng,
        fromName: shareData.route_from_name,
        toName: shareData.route_to_name,
      }
    }

    return shareData
  } catch (err) {
    await logAttribution('ATTRIBUTION_ERROR', {
      shareId,
      sessionId,
      error: err.message,
      metadata: { phase: 'share_arrival' },
    })
    return null
  }
}

/**
 * Update session with end time (called on page unload)
 */
export async function endSession(endedAtMs = Date.now()) {
  const payload = getSessionEndPayload(currentSessionId, endedAtMs)
  await postSessionMetric(payload, { keepalive: true })
}

// ============================================
// PAGE VIEW TRACKING
// ============================================

/**
 * Log a page view
 */
export async function logPageView(pagePath, options = {}) {
  trackEvent('page_view', { page_path: pagePath })
  
  if (!supabase) return
  
  try {
    const pageViewData = getPageViewData(pagePath, options.userId || null)
    const { error } = await supabase.from('page_views').insert(pageViewData)

    if (error && error.code === 'PGRST204') {
      const basicPageViewData = {
        session_id: pageViewData.session_id,
        page_path: pageViewData.page_path,
        referrer: pageViewData.referrer,
        user_agent: pageViewData.user_agent,
        screen_width: pageViewData.screen_width,
        screen_height: pageViewData.screen_height,
        is_internal: pageViewData.is_internal,
      }
      const { error: fallbackError } = await supabase.from('page_views').insert(basicPageViewData)
      if (fallbackError) throw fallbackError
    } else if (error) {
      throw error
    }
    // console.log('[STD] Page view logged:', pagePath)
  } catch (err) {
    console.error('Failed to log page view:', err)
  }
}

// ============================================
// SEARCH TRACKING
// ============================================

export async function logSearch(data) {
  // Track in GA4 / GTM
  trackEvent('search', {
    from_location: data.fromName,
    to_location: data.toName,
    distance_miles: data.distanceMiles,
    duration_minutes: Math.round(data.durationSeconds / 60),
    places_found: data.placesFound,
  })
  
  if (!supabase) return

  try {
    await supabase.from('searches').insert({
      session_id: getSessionId(),
      from_name: data.fromName,
      from_lat: data.fromLat,
      from_lng: data.fromLng,
      to_name: data.toName,
      to_lat: data.toLat,
      to_lng: data.toLng,
      midpoint_lat: data.midpointLat,
      midpoint_lng: data.midpointLng,
      distance_miles: data.distanceMiles,
      duration_seconds: data.durationSeconds,
      active_filters: data.activeFilters,
      places_found: data.placesFound,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      is_internal: isInternalUser(),
    })
  } catch (err) {
    console.error('Failed to log search:', err)
  }
}

// ============================================
// PLACE CLICK TRACKING
// ============================================

export async function logPlaceClick(data) {
  // Track in GA4 / GTM
  trackEvent('place_click', {
    place_name: data.placeName,
    place_category: data.placeCategory,
    place_rating: data.placeRating,
    search_route: data.fromTo,
  })
  
  if (!supabase) return

  try {
    await supabase.from('place_clicks').insert({
      session_id: getSessionId(),
      place_name: data.placeName,
      place_category: data.placeCategory,
      place_lat: data.placeLat,
      place_lng: data.placeLng,
      place_rating: data.placeRating,
      from_search_route: data.fromTo,
      midpoint_lat: data.midpointLat,
      midpoint_lng: data.midpointLng,
      is_internal: isInternalUser(),
    })
  } catch (err) {
    console.error('Failed to log place click:', err)
  }
}

// ============================================
// SHARE TRACKING
// ============================================

/**
 * Log when user shares — generates unique share ID and trackable URL.
 * Returns the share URL for the caller to use.
 */
export async function logShare(data) {
  trackEvent('share', {
    share_type: data.shareType,
    from_location: data.fromName,
    to_location: data.toName,
  })

  // Generate share ID and build trackable URL
  const shareId = generateShareId()
  let shareUrl = data.shareUrl || null // fallback

  if (data.fromLat && data.fromLng && data.toLat && data.toLng) {
    shareUrl = buildShareUrl(shareId, data.fromLat, data.fromLng, data.toLat, data.toLng)
  }

  // Final fallback: basic URL without coords
  if (!shareUrl) {
    const fallbackUrl = new URL(window.location.origin)
    if (data.fromName) fallbackUrl.searchParams.set('from', data.fromName)
    if (data.toName) fallbackUrl.searchParams.set('to', data.toName)
    shareUrl = fallbackUrl.toString()
  }

  // If internal user, tag the share URL so test clicks stay internal
  if (isInternalUser() && shareUrl) {
    const url = new URL(shareUrl)
    url.searchParams.set('_internal', '1')
    shareUrl = url.toString()
  }

  if (!supabase) return shareUrl

  try {
    // Retry logic for share ID collision (up to 3 attempts)
    let inserted = false
    let attempts = 0
    let currentShareId = shareId

    while (!inserted && attempts < 3) {
      const { error } = await supabase.from('shares').insert({
        session_id: getSessionId(),
        share_id: currentShareId,
        share_type: data.shareType,
        share_method: data.shareMethod || data.shareType,
        from_name: data.fromName,
        to_name: data.toName,
        route_from_name: data.fromName,
        route_to_name: data.toName,
        route_from_lat: data.fromLat || null,
        route_from_lng: data.fromLng || null,
        route_to_lat: data.toLat || null,
        route_to_lng: data.toLng || null,
        share_url: shareUrl,
        is_internal: isInternalUser(),
      })

      if (error && error.code === '23505') {
        // Unique constraint violation — retry with new ID
        attempts++
        currentShareId = generateShareId()
        if (data.fromLat && data.fromLng && data.toLat && data.toLng) {
          shareUrl = buildShareUrl(currentShareId, data.fromLat, data.fromLng, data.toLat, data.toLng)
        }
      } else if (error) {
        throw error
      } else {
        inserted = true
      }
    }

    await logAttribution('SHARE_CREATED', {
      shareId: currentShareId,
      sessionId: getSessionId(),
      metadata: {
        method: data.shareMethod || data.shareType,
        route: `${data.fromName} → ${data.toName}`,
      },
    })

  } catch (err) {
    console.error('Failed to log share:', err)
    await logAttribution('ATTRIBUTION_ERROR', {
      sessionId: getSessionId(),
      error: err.message,
      metadata: { phase: 'share_create' },
    })
  }

  return shareUrl
}

// ============================================
// OUTBOUND CLICK TRACKING
// ============================================

/**
 * Log clicks to external destinations (place websites, directions)
 */
export async function logOutboundClick(data) {
  trackEvent('outbound_click', {
    click_type: data.clickType,
    place_name: data.placeName,
    destination: data.destinationUrl,
  })
  
  if (!supabase) return

  try {
    await supabase.from('outbound_clicks').insert({
      session_id: getSessionId(),
      click_type: data.clickType, // 'place_website', 'place_directions', 'midpoint_directions'
      place_name: data.placeName,
      place_category: data.placeCategory,
      destination_url: data.destinationUrl,
      from_search_route: data.fromSearchRoute,
      is_internal: isInternalUser(),
    })
    // console.log('[STD] Outbound click logged:', data.clickType, data.placeName)
  } catch (err) {
    console.error('Failed to log outbound click:', err)
  }
}

// ============================================
// INITIALIZE SESSION END TRACKING
// ============================================

if (typeof window !== 'undefined') {
  // Track when user leaves
  window.addEventListener('beforeunload', () => {
    endSession()
  })
  
  // Also track on visibility change (mobile background)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      endSession()
    }
  })
}
