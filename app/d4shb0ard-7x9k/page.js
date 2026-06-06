'use client';

import { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  LineChart, Line
} from 'recharts';
import { useAuth } from '@/components/AuthProvider';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const COLORS = ['#0d9488', '#f97316', '#8b5cf6', '#3b82f6', '#ef4444', '#22c55e', '#eab308', '#ec4899'];
const SOURCE_COLORS = {
  direct: '#6b7280',
  organic: '#22c55e',
  social: '#3b82f6',
  share: '#f97316',
  referral: '#8b5cf6',
  email: '#eab308',
  paid: '#ef4444',
  unknown: '#d1d5db',
};

export default function AdminDashboard() {
  const { user, isLoggedIn, loading: authLoading } = useAuth();
  const isAdmin = user?.app_metadata?.role === 'admin';

  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [prevStats, setPrevStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [customValue, setCustomValue] = useState(5);
  const [customUnit, setCustomUnit] = useState('minutes');
  const [topPlaces, setTopPlaces] = useState([]);
  const [topRoutes, setTopRoutes] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [deviceStats, setDeviceStats] = useState([]);
  const [hourlyStats, setHourlyStats] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [geoStats, setGeoStats] = useState([]);
  const [returnVisitors, setReturnVisitors] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);
  const [userGrowthData, setUserGrowthData] = useState([]);
  const [cacheStats, setCacheStats] = useState({ uniqueRoutes: 0, repeatSearches: 0, repeatRate: 0 });
  const [repeatRoutes, setRepeatRoutes] = useState([]);
  // Attribution tab state
  const [sourceStats, setSourceStats] = useState([]);
  const [sourceTrend, setSourceTrend] = useState([]);
  const [topReferrers, setTopReferrers] = useState([]);
  const [utmCampaigns, setUtmCampaigns] = useState([]);
  const [sourceQuality, setSourceQuality] = useState([]);
  // Shares tab state
  const [shareFunnel, setShareFunnel] = useState(null);
  const [shareMethodStats, setShareMethodStats] = useState([]);
  const [topSharedRoutes, setTopSharedRoutes] = useState([]);
  const [shareTimeline, setShareTimeline] = useState([]);
  // Sessions tab state
  const [sessionTimelines, setSessionTimelines] = useState([]);
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [timelineAudience, setTimelineAudience] = useState('all');
  const [timelineActivity, setTimelineActivity] = useState('all');
  const [timelineDevice, setTimelineDevice] = useState('all');
  const [timelineSource, setTimelineSource] = useState('all');

  useEffect(() => {
    fetchStats();
  }, [timeRange, customValue, customUnit, activeTab]);

  const getTimeFilter = () => {
    const now = new Date();
    switch (timeRange) {
      case '1m': return new Date(now - 1 * 60 * 1000).toISOString();
      case '5m': return new Date(now - 5 * 60 * 1000).toISOString();
      case '15m': return new Date(now - 15 * 60 * 1000).toISOString();
      case '30m': return new Date(now - 30 * 60 * 1000).toISOString();
      case '1h': return new Date(now - 60 * 60 * 1000).toISOString();
      case '24h': return new Date(now - 24 * 60 * 60 * 1000).toISOString();
      case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'all': return '2020-01-01T00:00:00.000Z';
      case 'custom': {
        const multiplier = customUnit === 'minutes' ? 60 * 1000 : 
                          customUnit === 'hours' ? 60 * 60 * 1000 : 
                          24 * 60 * 60 * 1000;
        return new Date(now - customValue * multiplier).toISOString();
      }
      default: return new Date(now - 24 * 60 * 60 * 1000).toISOString();
    }
  };

  const parseState = (locationName) => {
    if (!locationName) return 'Unknown';
    const parts = locationName.split(',').map(p => p.trim());
    for (const part of parts) {
      if (/^[A-Z]{2}$/.test(part)) return part;
    }
    return parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  };

  const fetchStats = async () => {
    setLoading(true);
    const since = getTimeFilter();
    const shouldLoadSessions = activeTab === 'sessions';

    try {
      // ==================== OVERVIEW DATA ====================
      const [
        { count: totalSearches },
        { count: externalSearches },
        { count: placeClicks },
        { count: shares },
        { count: outboundClicks },
        { count: sessions },
        { count: anonymousSessions },
        { count: signedInSessions },
      ] = await Promise.all([
        supabase.from('searches').select('id', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('searches').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
        supabase.from('place_clicks').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
        supabase.from('shares').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
        supabase.from('outbound_clicks').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
        supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
        supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false).is('user_id', null),
        supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false).not('user_id', 'is', null),
      ]);

      setStats({
        totalSearches: totalSearches || 0,
        externalSearches: externalSearches || 0,
        placeClicks: placeClicks || 0,
        shares: shares || 0,
        outboundClicks: outboundClicks || 0,
        sessions: sessions || 0,
        anonymousSessions: anonymousSessions || 0,
        signedInSessions: signedInSessions || 0,
      });

      // Fetch previous period for comparison (same duration, shifted back)
      const now = new Date();
      const sinceDate = new Date(since);
      const periodMs = now - sinceDate;
      const prevStart = new Date(sinceDate - periodMs).toISOString();
      const prevEnd = since;

      const [
        { count: prevSessions },
        { count: prevSearches },
        { count: prevPlaceClicks },
        { count: prevShares },
        { count: prevOutbound },
        { count: prevAnonymousSessions },
        { count: prevSignedInSessions },
      ] = await Promise.all([
        supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd).eq('is_internal', false),
        supabase.from('searches').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd).eq('is_internal', false),
        supabase.from('place_clicks').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd).eq('is_internal', false),
        supabase.from('shares').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd).eq('is_internal', false),
        supabase.from('outbound_clicks').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd).eq('is_internal', false),
        supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd).eq('is_internal', false).is('user_id', null),
        supabase.from('sessions').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd).eq('is_internal', false).not('user_id', 'is', null),
      ]);

      setPrevStats({
        sessions: prevSessions || 0,
        externalSearches: prevSearches || 0,
        placeClicks: prevPlaceClicks || 0,
        shares: prevShares || 0,
        outboundClicks: prevOutbound || 0,
        anonymousSessions: prevAnonymousSessions || 0,
        signedInSessions: prevSignedInSessions || 0,
      });

      // Place clicks with categories (unique sessions)
      const { data: placesData } = await supabase
        .from('place_clicks')
        .select('id, place_name, place_category, session_id')
        .gte('created_at', since)
        .eq('is_internal', false).limit(10000);

      if (placesData) {
        const placeSessionSets = {};
        const catCounts = {};
        placesData.forEach(p => {
          if (!placeSessionSets[p.place_name]) placeSessionSets[p.place_name] = new Set();
          placeSessionSets[p.place_name].add(p.session_id || `row:${p.id}`);
          const cat = p.place_category || 'Other';
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        });
        setTopPlaces(Object.entries(placeSessionSets)
          .map(([name, sessions]) => ({ name: name.substring(0, 25), value: sessions.size }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10));
        setCategoryStats(Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({ name, value })));
      }

      // Searches for routes, geo, time stats
      const { data: routesData } = await supabase
        .from('searches')
        .select('id, from_name, to_name, created_at, session_id')
        .gte('created_at', since)
        .eq('is_internal', false).limit(10000);

      if (routesData) {
        const routeSessionSets = {};
        routesData.forEach(r => {
          const fromShort = r.from_name?.split(',')[0] || 'Unknown';
          const toShort = r.to_name?.split(',')[0] || 'Unknown';
          const route = `${fromShort} → ${toShort}`;
          if (!routeSessionSets[route]) routeSessionSets[route] = new Set();
          routeSessionSets[route].add(r.session_id || `row:${r.id}`);
        });
        setTopRoutes(Object.entries(routeSessionSets)
          .map(([name, sessions]) => ({ name: name.substring(0, 35), value: sessions.size }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8));

        const geoCounts = {};
        routesData.forEach(r => {
          const fromState = parseState(r.from_name);
          const toState = parseState(r.to_name);
          geoCounts[fromState] = (geoCounts[fromState] || 0) + 1;
          if (toState !== fromState) geoCounts[toState] = (geoCounts[toState] || 0) + 1;
        });
        setGeoStats(Object.entries(geoCounts)
          .sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([name, value]) => ({ name, value })));

        const hourCounts = {};
        for (let i = 0; i < 24; i++) hourCounts[i] = 0;
        routesData.forEach(r => { hourCounts[new Date(r.created_at).getUTCHours()]++; });
        setHourlyStats(Object.entries(hourCounts).map(([hour, searches]) => ({ hour: `${hour}:00`, searches })));

        if (['7d', '30d', 'all'].includes(timeRange)) {
          const dayCounts = {};
          routesData.forEach(r => { const day = new Date(r.created_at).toISOString().split('T')[0]; dayCounts[day] = (dayCounts[day] || 0) + 1; });
          setDailyStats(Object.entries(dayCounts).sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, searches]) => ({ date: date.substring(5), searches })));
        } else { setDailyStats([]); }

        // Cache efficiency
        const routeMap = {};
        routesData.forEach(r => { const key = `${r.from_name}|||${r.to_name}`; routeMap[key] = (routeMap[key] || 0) + 1; });
        const uniqueRoutes = Object.keys(routeMap).length;
        const repeatSearches = routesData.length - uniqueRoutes;
        const repeatRate = routesData.length > 0 ? (repeatSearches / routesData.length * 100) : 0;
        setCacheStats({ uniqueRoutes, repeatSearches, repeatRate: repeatRate.toFixed(1), potentialSavings: (repeatSearches * 0.20).toFixed(2) });
        setRepeatRoutes(Object.entries(routeMap).filter(([_, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([key, count]) => { const [from, to] = key.split('|||'); return { route: `${from?.split(',')[0] || '?'} → ${to?.split(',')[0] || '?'}`, count }; }));
      }

      // Device & visitor breakdown
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('device_type, visitor_id, source, source_detail, referrer_domain, utm_source, utm_medium, utm_campaign, created_at')
        .gte('created_at', since)
        .eq('is_internal', false).limit(10000);

      if (sessionsData) {
        const deviceCounts = { Mobile: 0, Desktop: 0, Tablet: 0 };
        const visitorSessions = {};
        sessionsData.forEach(s => {
          const type = s.device_type === 'mobile' ? 'Mobile' : s.device_type === 'tablet' ? 'Tablet' : 'Desktop';
          deviceCounts[type]++;
          if (s.visitor_id) visitorSessions[s.visitor_id] = (visitorSessions[s.visitor_id] || 0) + 1;
        });
        setDeviceStats(Object.entries(deviceCounts).filter(([_, v]) => v > 0).map(([name, value]) => ({ name, value })));
        const visitors = Object.values(visitorSessions);
        setReturnVisitors([
          { name: 'New', value: visitors.filter(c => c === 1).length },
          { name: 'Returning', value: visitors.filter(c => c > 1).length }
        ].filter(d => d.value > 0));

        // ==================== ATTRIBUTION DATA ====================
        // Traffic by source
        const srcCounts = {};
        sessionsData.forEach(s => { const src = s.source || 'unknown'; srcCounts[src] = (srcCounts[src] || 0) + 1; });
        setSourceStats(Object.entries(srcCounts).sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({ name, value, fill: SOURCE_COLORS[name] || '#d1d5db' })));

        // Source trend over time (daily)
        const srcByDay = {};
        sessionsData.forEach(s => {
          const day = new Date(s.created_at).toISOString().split('T')[0];
          const src = s.source || 'unknown';
          if (!srcByDay[day]) srcByDay[day] = {};
          srcByDay[day][src] = (srcByDay[day][src] || 0) + 1;
        });
        const allSources = [...new Set(sessionsData.map(s => s.source || 'unknown'))];
        setSourceTrend(Object.entries(srcByDay).sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, sources]) => ({ date: date.substring(5), ...allSources.reduce((acc, s) => ({ ...acc, [s]: sources[s] || 0 }), {}) })));

        // Top referrer domains
        const refCounts = {};
        sessionsData.forEach(s => { if (s.referrer_domain) refCounts[s.referrer_domain] = (refCounts[s.referrer_domain] || 0) + 1; });
        setTopReferrers(Object.entries(refCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
          .map(([name, value]) => ({ name, value })));

        // UTM campaign performance
        const campMap = {};
        sessionsData.forEach(s => {
          if (s.utm_campaign) {
            const key = `${s.utm_source || '?'} / ${s.utm_medium || '?'} / ${s.utm_campaign}`;
            campMap[key] = (campMap[key] || 0) + 1;
          }
        });
        setUtmCampaigns(Object.entries(campMap).sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({ name, value })));

        // Source quality: sessions by source
        const srcSessionCounts = {};
        sessionsData.forEach(s => {
          const src = s.source || 'unknown';
          srcSessionCounts[src] = (srcSessionCounts[src] || 0) + 1;
        });
        setSourceQuality(Object.entries(srcSessionCounts).sort((a, b) => b[1] - a[1])
          .map(([name, sessions]) => ({ name, sessions })));
      }

      // Recent searches
      const { data: recentData } = await supabase
        .from('searches')
        .select('from_name, to_name, distance_miles, created_at')
        .eq('is_internal', false)
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentSearches(recentData || []);

      // ==================== USER GROWTH ====================
      const { data: allProfiles } = await supabase
        .from('user_profiles')
        .select('created_at')
        .order('created_at', { ascending: true });

      if (allProfiles) {
        const byDay = {};
        allProfiles.forEach(p => {
          const day = new Date(p.created_at).toISOString().split('T')[0];
          byDay[day] = (byDay[day] || 0) + 1;
        });
        let cumulative = 0;
        const growth = Object.entries(byDay)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => {
            cumulative += count;
            return { date: date.substring(5), newUsers: count, totalUsers: cumulative };
          });
        setUserGrowthData(growth);
      }

      // ==================== SHARES DATA ====================
      // Share funnel
      const { count: totalShares } = await supabase
        .from('shares').select('*', { count: 'exact', head: true })
        .gte('created_at', since).eq('is_internal', false).limit(10000);
      const { count: totalShareClicks } = await supabase
        .from('share_clicks').select('*', { count: 'exact', head: true })
        .gte('created_at', since)
        .eq('is_internal', false);
      
      // Sessions from shares
      const shareSessionCount = sessionsData ? sessionsData.filter(s => s.source === 'share').length : 0;
      
      setShareFunnel({
        totalShares: totalShares || 0,
        totalClicks: totalShareClicks || 0,
        conversionRate: totalShares > 0 ? ((totalShareClicks / totalShares) * 100).toFixed(1) : '0.0',
        sessionsFromShares: shareSessionCount,
      });

      // Share method breakdown
      const { data: sharesData } = await supabase
        .from('shares')
        .select('share_method, route_from_name, route_to_name, click_count, created_at, share_id')
        .gte('created_at', since)
        .eq('is_internal', false).limit(10000);

      if (sharesData) {
        // Method breakdown
        const methodCounts = {};
        sharesData.forEach(s => {
          const method = s.share_method || s.share_type || 'unknown';
          methodCounts[method] = (methodCounts[method] || 0) + 1;
        });
        setShareMethodStats(Object.entries(methodCounts).sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({ name, value })));

        // Top shared routes
        const sharedRouteCounts = {};
        sharesData.forEach(s => {
          if (s.route_from_name && s.route_to_name) {
            const fromShort = s.route_from_name.split(',')[0] || '?';
            const toShort = s.route_to_name.split(',')[0] || '?';
            const key = `${fromShort} → ${toShort}`;
            sharedRouteCounts[key] = (sharedRouteCounts[key] || 0) + 1;
          }
        });
        setTopSharedRoutes(Object.entries(sharedRouteCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([name, value]) => ({ name, value })));

        // Share timeline (daily)
        const shareByDay = {};
        sharesData.forEach(s => {
          const day = new Date(s.created_at).toISOString().split('T')[0];
          shareByDay[day] = (shareByDay[day] || 0) + 1;
        });
        setShareTimeline(Object.entries(shareByDay).sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, count]) => ({ date: date.substring(5), shares: count })));
      }

      // ==================== SESSION TIMELINES ====================
      if (shouldLoadSessions) {
        try {
          const { data: recentSessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('session_id, visitor_id, user_id, started_at, ended_at, duration_seconds, created_at, device_type, source, source_detail, referrer_domain, landing_page, is_internal')
            .gte('created_at', since)
            .eq('is_internal', false)
            .order('created_at', { ascending: false })
            .limit(100);

          if (sessionsError) throw sessionsError;

          const sessionIds = (recentSessions || []).map(s => s.session_id).filter(Boolean);
          let timelineEvents = [];

          if (sessionIds.length > 0) {
            const { data: events, error: eventsError } = await supabase
              .from('session_events')
              .select('*')
              .in('session_id', sessionIds)
              .order('created_at', { ascending: true })
              .limit(5000);
            if (eventsError) throw eventsError;
            timelineEvents = events || [];
          }

          const eventsBySession = {};
          timelineEvents.forEach(e => {
            if (!eventsBySession[e.session_id]) eventsBySession[e.session_id] = [];
            eventsBySession[e.session_id].push(e);
          });

          setSessionTimelines((recentSessions || []).map(s => {
            const events = eventsBySession[s.session_id] || [];
            const eventTypes = events.reduce((acc, e) => {
              acc[e.event_type] = (acc[e.event_type] || 0) + 1;
              return acc;
            }, {});
            const firstEvent = events[0];
            const lastEvent = events[events.length - 1];
            const startedAt = s.started_at || s.created_at;
            const lastAt = lastEvent?.created_at || startedAt;
            const trackedDuration = Number.parseInt(s.duration_seconds, 10);
            const durationSeconds = Number.isFinite(trackedDuration)
              ? trackedDuration
              : Math.max(0, Math.round((new Date(lastAt) - new Date(startedAt)) / 1000));

            return {
              ...s,
              events,
              eventCount: events.length,
              durationSeconds,
              firstEventType: firstEvent?.event_type || null,
              lastEventType: lastEvent?.event_type || null,
              searches: eventTypes.search_completed || 0,
              placeClicks: eventTypes.place_click || 0,
              decisions:
                (eventTypes.midpoint_directions_clicked || 0) +
                (eventTypes.place_directions_clicked || 0) +
                (eventTypes.place_website_clicked || 0) +
                (eventTypes.place_call_clicked || 0) +
                (eventTypes.share_created || 0),
              gates: eventTypes.feature_gate_triggered || 0,
            };
          }));
        } catch (timelineErr) {
          console.warn('Session timeline fetch skipped:', timelineErr.message);
          setSessionTimelines([]);
        }
      }

    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
    setLoading(false);
  };

  // ==================== COMPONENTS ====================

  const getChangePercent = (current, previous) => {
    if (previous == null || previous === 0) return current > 0 ? { pct: '∞', up: true } : null;
    if (current == null) return null;
    const pct = ((current - previous) / previous * 100).toFixed(0);
    return { pct: `${Math.abs(pct)}%`, up: current >= previous, value: Number(pct) };
  };

  const StatCard = ({ label, value, subtext, icon, tooltip, prevValue }) => {
    const change = typeof value === 'number' && prevValue != null ? getChangePercent(value, prevValue) : null;
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 group relative">
        <div className="flex items-center gap-2">
          {icon && <span className="text-lg">{icon}</span>}
          <span className="text-sm text-gray-500 font-medium">{label}</span>
          {tooltip && <span className="text-gray-300 cursor-help text-xs">ⓘ</span>}
        </div>
        <div className="flex items-end gap-2 mt-1">
          <div className="text-3xl font-bold text-gray-900">{value?.toLocaleString?.() ?? value ?? '—'}</div>
          {change && (
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded mb-1 ${change.up ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>
              {change.up ? '↑' : '↓'} {change.pct}
            </span>
          )}
        </div>
        {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
        {change && <div className="text-[10px] text-gray-400 mt-0.5">vs previous period{prevValue != null ? ` (${prevValue.toLocaleString()})` : ''}</div>}
        {tooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 max-w-xs text-center">
            {tooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
          </div>
        )}
      </div>
    );
  };

  const formatSessionDuration = (seconds) => {
    if (!seconds || seconds < 1) return '0s';
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const rem = seconds % 60;
    if (mins < 60) return `${mins}m ${rem}s`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  };

  const filteredSessionTimelines = sessionTimelines.filter((session) => {
    if (timelineAudience === 'anonymous' && session.user_id) return false;
    if (timelineAudience === 'signed_in' && !session.user_id) return false;
    if (timelineActivity === 'with_searches' && session.searches < 1) return false;
    if (timelineActivity === 'no_decisions' && session.decisions > 0) return false;
    if (timelineActivity === 'with_decisions' && session.decisions < 1) return false;
    if (timelineActivity === 'with_gates' && session.gates < 1) return false;
    if (timelineDevice !== 'all' && (session.device_type || 'unknown') !== timelineDevice) return false;
    if (timelineSource !== 'all' && (session.source || 'unknown') !== timelineSource) return false;
    return true;
  });

  const timelineDevices = [...new Set(sessionTimelines.map(s => s.device_type || 'unknown'))].sort();
  const timelineSources = [...new Set(sessionTimelines.map(s => s.source || 'unknown'))].sort();

  const EVENT_DOT_COLORS = {
    navigation: 'bg-gray-400',
    search_funnel: 'bg-teal-500',
    results: 'bg-orange-500',
    map: 'bg-blue-500',
    route: 'bg-cyan-500',
    decision: 'bg-emerald-500',
    discovery: 'bg-amber-500',
    road_trip: 'bg-indigo-500',
    premium: 'bg-purple-500',
    monetization: 'bg-pink-500',
    auth: 'bg-slate-500',
  };

  const describeSessionEvent = (event) => {
    const m = event.metadata || {};
    switch (event.event_type) {
      case 'page_viewed':
        return m.path || event.page_path || '/';
      case 'input_started':
      case 'input_cleared':
        return m.field ? `${m.field} input` : '';
      case 'input_selected':
        return [m.field, m.locationName].filter(Boolean).join(': ');
      case 'search_clicked':
      case 'search_failed':
        return [m.from, m.to].filter(Boolean).join(' -> ') || m.error || '';
      case 'search_completed':
        return `${[m.from, m.to].filter(Boolean).join(' -> ')}${m.durationSeconds ? ` (${Math.round(m.durationSeconds / 60)} min)` : ''}`;
      case 'filter_toggle':
        return `${m.category || 'filter'} ${m.action || ''}`.trim();
      case 'places_loaded':
        return `${m.count || 0} places${m.categories?.length ? ` for ${m.categories.join(', ')}` : ''}`;
      case 'place_click':
        return `${m.placeName || 'Place'}${m.rank ? ` (#${m.rank})` : ''}${m.category ? `, ${m.category}` : ''}`;
      case 'map_marker_click':
        return `${m.placeName || 'Marker'}${m.category ? `, ${m.category}` : ''}`;
      case 'route_selected':
        return `${m.routeSummary || 'Route'}${m.routeIndex != null ? ` (#${m.routeIndex + 1})` : ''}`;
      case 'travel_mode_changed':
      case 'midpoint_mode_changed':
        return m.mode || '';
      case 'place_directions_clicked':
      case 'place_website_clicked':
      case 'place_call_clicked':
        return `${m.placeName || 'Place'}${m.source ? ` from ${m.source}` : ''}`;
      case 'midpoint_directions_clicked':
        return [m.from, m.to].filter(Boolean).join(' -> ');
      case 'share_created':
        return `${m.method || 'share'}: ${[m.from, m.to].filter(Boolean).join(' -> ')}`;
      case 'roulette_spin':
        return `${m.placeName || 'Pick'}${m.rollNumber ? `, roll #${m.rollNumber}` : ''}`;
      case 'feature_gate_triggered':
        return `${m.feature || 'feature'} (${m.reason || 'locked'})`;
      case 'road_trip_activated':
        return `${m.stopCount || 0} stops every ${m.intervalValue || '?'} ${m.intervalMode || ''}`;
      case 'road_trip_stop_selected':
        return `${m.label || 'Stop'}${m.stopIndex != null ? ` (#${m.stopIndex + 1})` : ''}`;
      case 'sign_in':
        return `${m.method || 'unknown'}${m.email ? `, ${m.email}` : ''}`;
      default:
        return Object.keys(m).length ? JSON.stringify(m) : '';
    }
  };

  const SessionsTab = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">Session Timelines</h3>
          <span className="text-xs text-gray-400">{filteredSessionTimelines.length} of {sessionTimelines.length} recent sessions</span>
        </div>
        <p className="text-sm text-gray-500">
          Ordered product events by session. New data appears after the session_events migration is applied.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <label className="text-xs font-medium text-gray-500">
            Audience
            <select
              value={timelineAudience}
              onChange={(e) => setTimelineAudience(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All sessions</option>
              <option value="anonymous">Anonymous</option>
              <option value="signed_in">Signed in</option>
            </select>
          </label>
          <label className="text-xs font-medium text-gray-500">
            Activity
            <select
              value={timelineActivity}
              onChange={(e) => setTimelineActivity(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All activity</option>
              <option value="with_searches">With searches</option>
              <option value="no_decisions">No decisions</option>
              <option value="with_decisions">With decisions</option>
              <option value="with_gates">Hit a gate</option>
            </select>
          </label>
          <label className="text-xs font-medium text-gray-500">
            Device
            <select
              value={timelineDevice}
              onChange={(e) => setTimelineDevice(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All devices</option>
              {timelineDevices.map(device => (
                <option key={device} value={device}>{device}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-gray-500">
            Source
            <select
              value={timelineSource}
              onChange={(e) => setTimelineSource(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All sources</option>
              {timelineSources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {filteredSessionTimelines.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          No sessions match these filters.
        </div>
      ) : (
        filteredSessionTimelines.map((session) => {
          const isExpanded = expandedSessionId === session.session_id;
          return (
            <div key={session.session_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                onClick={() => setExpandedSessionId(isExpanded ? null : session.session_id)}
                className="w-full px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {new Date(session.started_at || session.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-xs text-gray-400">{session.device_type || 'unknown'}</span>
                      <span className="text-xs text-gray-400">{session.source || 'unknown'}</span>
                      {session.referrer_domain && <span className="text-xs text-gray-400">{session.referrer_domain}</span>}
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        session.user_id ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {session.user_id ? 'signed in' : 'anonymous'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {session.visitor_id || 'no visitor'} &middot; {session.session_id}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-600 text-xs font-medium">{session.eventCount} events</span>
                    <span className="px-2 py-1 rounded-md bg-teal-50 text-teal-700 text-xs font-medium">{session.searches} searches</span>
                    <span className="px-2 py-1 rounded-md bg-orange-50 text-orange-700 text-xs font-medium">{session.placeClicks} places</span>
                    <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">{session.decisions} decisions</span>
                    {session.gates > 0 && (
                      <span className="px-2 py-1 rounded-md bg-purple-50 text-purple-700 text-xs font-medium">{session.gates} gates</span>
                    )}
                    <span className="px-2 py-1 rounded-md bg-gray-50 text-gray-500 text-xs font-medium">
                      {formatSessionDuration(session.durationSeconds)}
                    </span>
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 px-5 py-4">
                  {session.events.length === 0 ? (
                    <div className="text-sm text-gray-400">No events recorded for this session.</div>
                  ) : (
                    <div className="relative">
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-200" />
                      <div className="space-y-3">
                        {session.events.map((event) => {
                          const secondsFromStart = Math.max(0, Math.round((new Date(event.created_at) - new Date(session.started_at || session.created_at)) / 1000));
                          const dotColor = EVENT_DOT_COLORS[event.event_group] || 'bg-gray-400';
                          return (
                            <div key={event.id} className="relative flex gap-3">
                              <div className={`w-3.5 h-3.5 rounded-full ${dotColor} mt-1.5 z-10 ring-4 ring-white`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-gray-800">{event.event_label || event.event_type}</span>
                                  <span className="text-[11px] text-gray-400">+{formatSessionDuration(secondsFromStart)}</span>
                                  <span className="text-[10px] text-gray-300">{event.event_group}</span>
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {describeSessionEvent(event)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  const funnelData = stats ? [
    { name: 'Sessions', value: stats.sessions, fill: '#3b82f6' },
    { name: 'Searches', value: stats.externalSearches, fill: '#0d9488' },
    { name: 'Place Clicks', value: stats.placeClicks, fill: '#f97316' },
    { name: 'Outbound', value: stats.outboundClicks, fill: '#8b5cf6' },
  ] : [];

  const allSourceKeys = [...new Set(sourceStats.map(s => s.name))];

  // ==================== TAB: OVERVIEW ====================
  const OverviewTab = () => (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4 mb-6">
        <StatCard icon="👤" label="Total Users" value={userGrowthData.length > 0 ? userGrowthData[userGrowthData.length - 1].totalUsers : 0} tooltip="Registered users (all time)." />
        <StatCard icon="👥" label="Sessions" value={stats?.sessions} prevValue={prevStats?.sessions} tooltip="Unique visits to the site." />
        <StatCard icon="A" label="Anonymous" value={stats?.anonymousSessions} prevValue={prevStats?.anonymousSessions} subtext={stats?.sessions > 0 ? `${((stats?.anonymousSessions / stats.sessions) * 100).toFixed(0)}% of sessions` : ''} tooltip="Sessions that have not been linked to a signed-in user." />
        <StatCard icon="ID" label="Signed In" value={stats?.signedInSessions} prevValue={prevStats?.signedInSessions} subtext={stats?.sessions > 0 ? `${((stats?.signedInSessions / stats.sessions) * 100).toFixed(0)}% of sessions` : ''} tooltip="Sessions associated with a logged-in user." />
        <StatCard icon="🔍" label="Searches" value={stats?.externalSearches} prevValue={prevStats?.externalSearches} tooltip="Midpoint searches performed." />
        <StatCard icon="📍" label="Place Clicks" value={stats?.placeClicks} prevValue={prevStats?.placeClicks} tooltip="Clicks on place cards." />
        <StatCard icon="🔗" label="Shares" value={stats?.shares} prevValue={prevStats?.shares} tooltip="Times users shared results." />
        <StatCard icon="🚀" label="Outbound" value={stats?.outboundClicks} prevValue={prevStats?.outboundClicks} tooltip="Clicks to Google Maps, place sites." />
        <StatCard icon="📈" label="Click Rate" value={stats?.externalSearches > 0 ? `${((stats?.placeClicks / stats?.externalSearches) * 100).toFixed(1)}%` : '—'} subtext="Clicks / Searches" tooltip="% of searches resulting in place clicks." />
      </div>

      {/* Conversion Funnel */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">📈 Conversion Funnel</h2>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart layout="vertical" data={funnelData} margin={{ left: 80, right: 30 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={70} />
            <Tooltip formatter={(v) => v.toLocaleString()} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {funnelData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-between mt-2 text-xs text-gray-500 px-20">
          <span>Sessions → Searches: {stats?.sessions > 0 ? `${((stats?.externalSearches / stats?.sessions) * 100).toFixed(0)}%` : '—'}</span>
          <span>Searches → Clicks: {stats?.externalSearches > 0 ? `${((stats?.placeClicks / stats?.externalSearches) * 100).toFixed(0)}%` : '—'}</span>
          <span>Clicks → Outbound: {stats?.placeClicks > 0 ? `${((stats?.outboundClicks / stats?.placeClicks) * 100).toFixed(0)}%` : '—'}</span>
        </div>
      </div>

      {/* Users Over Time */}
      {userGrowthData.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">👥 Users Over Time</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={userGrowthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Bar dataKey="totalUsers" fill="#0d9488" radius={[4, 4, 0, 0]} name="Total Users" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-600 rounded-sm inline-block"></span> Cumulative Users</span>
            {userGrowthData.length > 0 && (
              <span>Latest: <strong className="text-gray-700">{userGrowthData[userGrowthData.length - 1].totalUsers}</strong> users</span>
            )}
          </div>
        </div>
      )}

      {/* Cache Efficiency */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">💰 Cache Efficiency</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-gray-900">{cacheStats.uniqueRoutes.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Unique Routes</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-500">{cacheStats.repeatSearches.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Repeat Searches</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-teal-600">{cacheStats.repeatRate}%</div>
            <div className="text-xs text-gray-500">Repeat Rate</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">${cacheStats.potentialSavings}</div>
            <div className="text-xs text-gray-500">Potential Savings</div>
          </div>
        </div>
        {repeatRoutes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Top Repeated Routes</h3>
            <div className="space-y-1">
              {repeatRoutes.map((r, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate" style={{maxWidth: '80%'}}>{r.route}</span>
                  <span className="font-medium text-orange-500">{r.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hourly Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">⏰ Searches by Hour (UTC)</h2>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={hourlyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorSearches" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#0d9488" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="hour" tick={{ fontSize: 10 }} tickLine={false} interval={2} />
            <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <Tooltip />
            <Area type="monotone" dataKey="searches" stroke="#0d9488" strokeWidth={2} fillOpacity={1} fill="url(#colorSearches)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Daily Trend with Moving Average */}
      {dailyStats.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">📅 Daily Searches</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={dailyStats.map((d, i, arr) => {
              // Calculate 7-day moving average
              const window = arr.slice(Math.max(0, i - 6), i + 1);
              const avg = window.reduce((sum, w) => sum + w.searches, 0) / window.length;
              // Day-over-day change
              const prev = i > 0 ? arr[i - 1].searches : d.searches;
              const change = prev > 0 ? ((d.searches - prev) / prev * 100).toFixed(0) : 0;
              return { ...d, avg: Math.round(avg), change: Number(change) };
            })} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip formatter={(value, name) => [value, name === 'avg' ? '7-day avg' : name === 'searches' ? 'Searches' : name]} />
              <Line type="monotone" dataKey="searches" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
              <Line type="monotone" dataKey="avg" stroke="#f97316" strokeWidth={2} strokeDasharray="5 5" dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block"></span> Daily</span>
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-orange-500 inline-block border-dashed"></span> 7-day avg</span>
          </div>
        </div>
      )}

      {/* Four Column Layout */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">📱 Devices</h2>
          {deviceStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={deviceStats} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                  {deviceStats.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No data</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">🔄 Visitors</h2>
          {returnVisitors.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={returnVisitors} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                  {returnVisitors.map((_, index) => <Cell key={index} fill={index === 0 ? '#0d9488' : '#f97316'} />)}
                </Pie>
                <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No data yet</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">🏷️ Categories</h2>
          {categoryStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie data={categoryStats.slice(0, 5)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                  {categoryStats.slice(0, 5).map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No data</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">🗺️ Top Regions</h2>
          {geoStats.length > 0 ? (
            <div className="space-y-2">
              {geoStats.slice(0, 6).map((item, i) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="text-sm text-gray-700"><span className="text-gray-400 mr-2">{i + 1}.</span>{item.name}</span>
                  <span className="text-sm font-medium text-teal-600">{item.value}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-8">No data</p>}
        </div>
      </div>

      {/* Top Places & Routes */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">🏆 Top Places Clicked</h2>
          {topPlaces.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topPlaces} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={120} />
                <Tooltip /><Bar dataKey="value" fill="#0d9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No data yet</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">🛣️ Top Routes</h2>
          {topRoutes.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topRoutes} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                <Tooltip /><Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No data yet</p>}
        </div>
      </div>

      {/* Recent Searches */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">🕐 Recent Searches</h2>
        {recentSearches.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">From</th>
                  <th className="pb-2 font-medium">To</th>
                  <th className="pb-2 font-medium">Distance</th>
                  <th className="pb-2 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {recentSearches.map((s, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 truncate" style={{maxWidth: '200px'}}>{s.from_name}</td>
                    <td className="py-2 truncate" style={{maxWidth: '200px'}}>{s.to_name}</td>
                    <td className="py-2">{s.distance_miles?.toFixed(0) || '—'} mi</td>
                    <td className="py-2 text-gray-400">{new Date(s.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-400 text-center py-4">No searches yet</p>}
      </div>
    </>
  );

  // ==================== TAB: ATTRIBUTION ====================
  const AttributionTab = () => (
    <>
      {/* Source KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {sourceStats.slice(0, 4).map(s => {
          const tooltips = {
            direct: 'Visitors who typed the URL directly or used a bookmark.',
            organic: 'Visitors from search engines (Google, Bing, etc.).',
            social: 'Visitors from social media platforms (Twitter, Facebook, etc.).',
            share: 'Visitors who clicked a shared link from another user.',
            referral: 'Visitors from other websites linking to us.',
            email: 'Visitors from email campaigns or newsletters.',
            paid: 'Visitors from paid ads (CPC, display, etc.).',
            unknown: 'Sessions created before attribution tracking was added.',
          };
          return (
            <StatCard key={s.name} icon={
              s.name === 'direct' ? '🔗' : s.name === 'organic' ? '🌿' : s.name === 'social' ? '📱' : 
              s.name === 'share' ? '📤' : s.name === 'referral' ? '🔀' : s.name === 'email' ? '✉️' : s.name === 'paid' ? '💰' : '📊'
            } label={s.name.charAt(0).toUpperCase() + s.name.slice(1)} value={s.value} 
            subtext={stats?.sessions > 0 ? `${((s.value / stats.sessions) * 100).toFixed(1)}% of traffic` : ''}
            tooltip={tooltips[s.name] || `Sessions attributed to ${s.name}.`} />
          );
        })}
      </div>

      {/* Traffic by Source */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 group relative inline-flex items-center gap-1.5">🔗 Traffic by Source <span className="text-gray-300 cursor-help text-xs">ⓘ</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">Breakdown of where your visitors come from.</span>
          </h2>
          {sourceStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={sourceStats} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {sourceStats.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                </Pie>
                <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No attribution data yet</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 group relative inline-flex items-center gap-1.5">🌐 Top Referrer Domains <span className="text-gray-300 cursor-help text-xs">ⓘ</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">External websites that sent traffic to us.</span>
          </h2>
          {topReferrers.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topReferrers} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                <Tooltip /><Bar dataKey="value" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No referral data yet</p>}
        </div>
      </div>

      {/* Source Trend Over Time */}
      {sourceTrend.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4 group relative inline-flex items-center gap-1.5">📈 Source Trend (Daily) <span className="text-gray-300 cursor-help text-xs">ⓘ</span>
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">Daily sessions stacked by traffic source over time.</span>
          </h2>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={sourceTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              {allSourceKeys.map((key) => (
                <Area key={key} type="monotone" dataKey={key} stackId="1" stroke={SOURCE_COLORS[key] || '#d1d5db'} fill={SOURCE_COLORS[key] || '#d1d5db'} fillOpacity={0.6} />
              ))}
              <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* UTM Campaigns */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 group relative inline-flex items-center gap-1.5">🎯 UTM Campaign Performance <span className="text-gray-300 cursor-help text-xs">ⓘ</span>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 max-w-xs">Sessions from links with UTM tracking params (?utm_source, utm_medium, utm_campaign).</span>
        </h2>
        {utmCampaigns.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 font-medium">Source / Medium / Campaign</th>
                  <th className="pb-2 font-medium text-right">Sessions</th>
                  <th className="pb-2 font-medium text-right">% of Total</th>
                </tr>
              </thead>
              <tbody>
                {utmCampaigns.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-medium text-gray-700">{c.name}</td>
                    <td className="py-2 text-right">{c.value}</td>
                    <td className="py-2 text-right text-gray-400">{stats?.sessions > 0 ? `${((c.value / stats.sessions) * 100).toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">No UTM campaign data yet</p>
            <p className="text-xs text-gray-300 mt-1">Add ?utm_source=x&utm_medium=y&utm_campaign=z to your links</p>
          </div>
        )}
      </div>

      {/* Source Quality */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4 group relative inline-flex items-center gap-1.5">⭐ Sessions by Source <span className="text-gray-300 cursor-help text-xs">ⓘ</span>
          <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">Horizontal bars showing relative volume from each source.</span>
        </h2>
        {sourceQuality.length > 0 ? (
          <div className="space-y-3">
            {sourceQuality.map(sq => {
              const pct = stats?.sessions > 0 ? (sq.sessions / stats.sessions) * 100 : 0;
              return (
                <div key={sq.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 w-20">{sq.name}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: SOURCE_COLORS[sq.name] || '#d1d5db' }}></div>
                  </div>
                  <span className="text-sm font-medium text-gray-600 w-16 text-right">{sq.sessions}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-gray-400 text-center py-8">No data yet</p>}
      </div>
    </>
  );

  // ==================== TAB: SHARES ====================
  const SharesTab = () => (
    <>
      {/* Share Funnel KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard icon="📤" label="Total Shares" value={shareFunnel?.totalShares} tooltip="Total share button clicks" />
        <StatCard icon="👆" label="Link Clicks" value={shareFunnel?.totalClicks} tooltip="Visits from shared links" />
        <StatCard icon="📊" label="Conversion" value={`${shareFunnel?.conversionRate || 0}%`} subtext="Clicks / Shares" tooltip="% of shares that resulted in a visit" />
        <StatCard icon="🔄" label="From Shares" value={shareFunnel?.sessionsFromShares} tooltip="Sessions where source = share" />
      </div>

      {/* Share Method Breakdown + Top Shared Routes */}
      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">📊 Share Methods</h2>
          {shareMethodStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={shareMethodStats} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {shareMethodStats.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip /><Legend iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No shares yet</p>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">🛣️ Top Shared Routes</h2>
          {topSharedRoutes.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topSharedRoutes} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                <Tooltip /><Bar dataKey="value" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No shared routes yet</p>}
        </div>
      </div>

      {/* Share Timeline */}
      {shareTimeline.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">📅 Shares Over Time</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={shareTimeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorShares" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Area type="monotone" dataKey="shares" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#colorShares)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Viral Coefficient Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-900 mb-4">🧬 Viral Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {shareFunnel?.totalShares > 0 && stats?.sessions > 0 
                ? (shareFunnel.totalShares / stats.sessions).toFixed(2) 
                : '0.00'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Shares per Session</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {shareFunnel?.totalShares > 0 
                ? (shareFunnel.totalClicks / shareFunnel.totalShares).toFixed(2)
                : '0.00'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Clicks per Share</div>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {shareFunnel?.totalShares > 0 && stats?.sessions > 0
                ? ((shareFunnel.totalShares / stats.sessions) * (shareFunnel.totalClicks / Math.max(shareFunnel.totalShares, 1))).toFixed(3)
                : '0.000'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Viral Coefficient (K)</div>
            <div className="text-[10px] text-gray-400 mt-0.5">K &gt; 1.0 = organic growth</div>
          </div>
        </div>
      </div>
    </>
  );

  // ==================== FEATURES TAB ====================
  const [featureFlags, setFeatureFlags] = useState([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [waitlistCounts, setWaitlistCounts] = useState({});

  const fetchFeatures = async () => {
    if (!supabase) return;
    setFeaturesLoading(true);
    try {
      const [{ data: flags, error: flagsErr }, { data: waitlist }] = await Promise.all([
        supabase.from('feature_flags').select('*').order('sort_order', { ascending: true }),
        supabase.from('feature_waitlist').select('feature_key'),
      ]);
      if (flagsErr) throw new Error(flagsErr.message);
      setFeatureFlags(flags || []);
      const counts = {};
      (waitlist || []).forEach(w => { counts[w.feature_key] = (counts[w.feature_key] || 0) + 1; });
      setWaitlistCounts(counts);
    } catch (err) {
      console.error('Features fetch error:', err);
    }
    setFeaturesLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'features' && featureFlags.length === 0) {
      fetchFeatures();
    }
  }, [activeTab]);

  const updateFeatureFlag = async (key, field, value) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('feature_flags')
        .update({ [field]: value })
        .eq('key', key)
        .select()
        .single();
      if (error) throw new Error(error.message);
      setFeatureFlags(prev => prev.map(f => f.key === key ? { ...f, ...data } : f));
    } catch (err) {
      console.error('Feature update error:', err);
    }
  };

  const STATUS_BADGE = {
    hidden: 'bg-gray-100 text-gray-500',
    coming_soon: 'bg-amber-100 text-amber-700',
    live: 'bg-emerald-100 text-emerald-700',
  };

  const TIER_BADGE = {
    anonymous: 'bg-gray-100 text-gray-600',
    free: 'bg-emerald-100 text-emerald-700',
    premium: 'bg-purple-100 text-purple-700',
    enterprise: 'bg-blue-100 text-blue-700',
  };

  const FeaturesTab = () => (
    <>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-gray-900">Feature Flags</h3>
        <button onClick={fetchFeatures} className="px-3 py-1.5 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition">
          {featuresLoading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Feature</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Tier</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Waitlist</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Enabled</th>
            </tr>
          </thead>
          <tbody>
            {featureFlags.map((flag) => (
              <tr key={flag.key} className="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                {/* Feature name */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{flag.emoji}</span>
                    <div>
                      <div className="font-medium text-gray-900">{flag.label}</div>
                      <div className="text-xs text-gray-400 max-w-[250px] truncate">{flag.description}</div>
                    </div>
                  </div>
                </td>

                {/* Status dropdown */}
                <td className="px-4 py-3">
                  <select
                    value={flag.status}
                    onChange={(e) => updateFeatureFlag(flag.key, 'status', e.target.value)}
                    className={`px-2 py-1 rounded-full text-xs font-bold border-0 cursor-pointer ${STATUS_BADGE[flag.status] || STATUS_BADGE.hidden}`}
                  >
                    <option value="hidden">Hidden</option>
                    <option value="coming_soon">Coming Soon</option>
                    <option value="live">Live</option>
                  </select>
                </td>

                {/* Tier dropdown */}
                <td className="px-4 py-3">
                  <select
                    value={flag.tier}
                    onChange={(e) => updateFeatureFlag(flag.key, 'tier', e.target.value)}
                    className={`px-2 py-1 rounded-full text-xs font-bold border-0 cursor-pointer ${TIER_BADGE[flag.tier] || TIER_BADGE.anonymous}`}
                  >
                    <option value="anonymous">Anonymous</option>
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </td>

                {/* Waitlist count */}
                <td className="px-4 py-3 text-center">
                  {waitlistCounts[flag.key] ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-700">
                      🔔 {waitlistCounts[flag.key]}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                {/* Enabled toggle */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => updateFeatureFlag(flag.key, 'enabled', !flag.enabled)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      flag.enabled ? 'bg-emerald-500' : 'bg-gray-300'
                    }`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      flag.enabled ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {featureFlags.length === 0 && !featuresLoading && (
          <div className="text-center py-8 text-gray-400 text-sm">
            No feature flags found. Run the migration to seed them.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 p-4 bg-gray-50 rounded-xl text-xs text-gray-500">
        <div className="font-semibold text-gray-700 mb-2">How it works:</div>
        <ul className="space-y-1">
          <li><strong>Status:</strong> Hidden (not shown) → Coming Soon (teaser + Notify Me) → Live (functional)</li>
          <li><strong>Tier:</strong> Anonymous (no login) → Free (login required) → Premium ($4.99/mo) → Enterprise</li>
          <li><strong>Enabled:</strong> Kill switch — overrides everything. Disabled = invisible to all users.</li>
          <li>Changes take effect on next page load (client caches flags for 1 min, or instantly on tab switch).</li>
        </ul>
      </div>
    </>
  );

  // ==================== USERS TAB STATE ====================
  const [usersList, setUsersList] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersSearch, setUsersSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedUserProfile, setSelectedUserProfile] = useState(null);
  const [userEvents, setUserEvents] = useState([]);
  const [userEventsLoading, setUserEventsLoading] = useState(false);

  const fetchUsers = async () => {
    if (!supabase) return;
    setUsersLoading(true);
    try {
      // Fetch all user profiles
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // For each user, get event counts
      const enriched = await Promise.all((profiles || []).map(async (p) => {
        const [
          { count: eventCount },
          { data: lastEvent },
        ] = await Promise.all([
          supabase.from('user_events').select('*', { count: 'exact', head: true }).eq('user_id', p.id),
          supabase.from('user_events').select('event_type, created_at').eq('user_id', p.id).order('created_at', { ascending: false }).limit(1),
        ]);
        return {
          ...p,
          eventCount: eventCount || 0,
          lastActive: lastEvent?.[0]?.created_at || p.updated_at || p.created_at,
          lastEventType: lastEvent?.[0]?.event_type || null,
        };
      }));

      setUsersList(enriched);
    } catch (err) {
      console.error('Users fetch error:', err);
    }
    setUsersLoading(false);
  };

  const fetchUserDetail = async (userId) => {
    if (!supabase || !userId) return;
    setUserEventsLoading(true);
    setSelectedUserId(userId);

    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setSelectedUserProfile(profile);

      // Fetch all events for this user
      const { data: events } = await supabase
        .from('user_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(500);
      setUserEvents(events || []);
    } catch (err) {
      console.error('User detail fetch error:', err);
    }
    setUserEventsLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'users' && usersList.length === 0) {
      fetchUsers();
    }
  }, [activeTab]);

  const EVENT_ICONS = {
    search: '🔍',
    place_click: '📍',
    filter_toggle: '🗂️',
    roulette_spin: '🎲',
    road_trip_activated: '🛣️',
    road_trip_stop_selected: '📌',
    drift_radius_toggled: '🎯',
    share_created: '🔗',
    sign_in: '🔐',
    upgrade_completed: '💎',
    travel_mode_changed: '🚗',
    midpoint_mode_changed: '📏',
    outbound_click: '🚀',
    group_location_added: '👥',
    pricing_modal_opened: '💰',
    search_history_resplit: '🕐',
  };

  const EVENT_LABELS = {
    search: 'Search',
    place_click: 'Place Click',
    filter_toggle: 'Filter Toggle',
    roulette_spin: 'Roulette Spin',
    road_trip_activated: 'Road Trip',
    road_trip_stop_selected: 'Stop Selected',
    drift_radius_toggled: 'Drift Radius',
    share_created: 'Share',
    sign_in: 'Sign In',
    upgrade_completed: 'Upgrade',
    travel_mode_changed: 'Travel Mode',
    midpoint_mode_changed: 'Midpoint Mode',
    outbound_click: 'Outbound Click',
    group_location_added: 'Group Search',
    pricing_modal_opened: 'Viewed Pricing',
    search_history_resplit: 'Re-split',
  };

  const filteredUsers = usersSearch.trim()
    ? usersList.filter(u =>
        (u.display_name || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(usersSearch.toLowerCase())
      )
    : usersList;

  // ---- User Detail View ----
  const UserDetailView = () => {
    if (!selectedUserProfile) return null;
    const p = selectedUserProfile;

    // Compute stats from events
    const eventsByType = {};
    userEvents.forEach(e => {
      eventsByType[e.event_type] = (eventsByType[e.event_type] || 0) + 1;
    });

    // Group events by day for the timeline
    const eventsByDay = {};
    userEvents.forEach(e => {
      const day = new Date(e.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(e);
    });

    return (
      <div>
        {/* Back button */}
        <button
          onClick={() => { setSelectedUserId(null); setSelectedUserProfile(null); setUserEvents([]); }}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Users
        </button>

        {/* Profile header */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-4">
            {p.avatar_url ? (
              <img src={p.avatar_url} alt="" className="w-14 h-14 rounded-full" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xl font-bold">
                {(p.display_name || p.email || '?')[0].toUpperCase()}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-bold text-gray-900">{p.display_name || 'No name'}</h3>
              <p className="text-sm text-gray-500">{p.email}</p>
              <div className="flex items-center gap-3 mt-1.5">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.plan === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {(p.plan || 'free').toUpperCase()}
                </span>
                <span className="text-xs text-gray-400">
                  Joined {new Date(p.created_at).toLocaleDateString()}
                </span>
                <span className="text-xs text-gray-400">
                  {userEvents.length} events tracked
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-6">
          {Object.entries(eventsByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <div key={type} className="bg-white rounded-lg border border-gray-100 p-3 text-center">
              <span className="text-lg">{EVENT_ICONS[type] || '📝'}</span>
              <div className="text-xl font-bold text-gray-900 mt-1">{count}</div>
              <div className="text-[10px] text-gray-400 font-medium uppercase">{EVENT_LABELS[type] || type}</div>
            </div>
          ))}
        </div>

        {/* Activity Timeline */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Activity Timeline</h3>
          {userEventsLoading ? (
            <div className="text-center py-8 text-gray-400">Loading events...</div>
          ) : userEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No events recorded yet</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(eventsByDay).map(([day, events]) => (
                <div key={day}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{day}</div>
                  <div className="space-y-1.5">
                    {events.map((e) => (
                      <div key={e.id} className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <span className="text-base shrink-0 mt-0.5">{EVENT_ICONS[e.event_type] || '📝'}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">
                              {EVENT_LABELS[e.event_type] || e.event_type}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {new Date(e.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {e.metadata && Object.keys(e.metadata).length > 0 && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate">
                              {e.event_type === 'search' && e.metadata.from && e.metadata.to && (
                                <>{e.metadata.from.split(',')[0]} → {e.metadata.to.split(',')[0]} ({e.metadata.distanceMiles} mi, {e.metadata.durationMin} min)</>
                              )}
                              {e.event_type === 'place_click' && e.metadata.placeName && (
                                <>{e.metadata.placeName} ({e.metadata.category})</>
                              )}
                              {e.event_type === 'filter_toggle' && e.metadata.category && (
                                <>Category: {e.metadata.category}</>
                              )}
                              {e.event_type === 'roulette_spin' && e.metadata.placeName && (
                                <>{e.metadata.placeName} (roll #{e.metadata.rollNumber})</>
                              )}
                              {e.event_type === 'road_trip_activated' && (
                                <>{e.metadata.stopCount} stops every {e.metadata.intervalValue} {e.metadata.intervalMode === 'distance' ? 'mi' : 'min'}</>
                              )}
                              {e.event_type === 'drift_radius_toggled' && (
                                <>±{e.metadata.minutes} min ({e.metadata.travelMode})</>
                              )}
                              {e.event_type === 'share_created' && (
                                <>{e.metadata.method}: {e.metadata.from?.split(',')[0]} → {e.metadata.to?.split(',')[0]}</>
                              )}
                              {e.event_type === 'sign_in' && (
                                <>{e.metadata.method} ({e.metadata.email})</>
                              )}
                              {e.event_type === 'upgrade_completed' && (
                                <>Plan: {e.metadata.plan}</>
                              )}
                              {e.event_type === 'travel_mode_changed' && (
                                <>Switched to: {e.metadata.mode}</>
                              )}
                              {e.event_type === 'midpoint_mode_changed' && (
                                <>Switched to: {e.metadata.mode}</>
                              )}
                              {e.event_type === 'outbound_click' && (
                                <>{e.metadata.type}{e.metadata.placeName ? `: ${e.metadata.placeName}` : ''}</>
                              )}
                              {e.event_type === 'group_location_added' && (
                                <>{e.metadata.totalPeople} people total</>
                              )}
                              {e.event_type === 'pricing_modal_opened' && (
                                <>Viewed pricing page</>
                              )}
                              {e.event_type === 'search_history_resplit' && e.metadata.from && (
                                <>{e.metadata.from.split(',')[0]} → {e.metadata.to?.split(',')[0]}</>
                              )}
                              {e.event_type === 'road_trip_stop_selected' && (
                                <>Stop {e.metadata.stopIndex + 1}: {e.metadata.label}</>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ---- Users List View ----
  const UsersTab = () => {
    if (selectedUserId) return <UserDetailView />;

    return (
      <>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{usersList.length} Users</h3>
            <p className="text-xs text-gray-400">Click a user to see their activity</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={usersSearch}
              onChange={(e) => setUsersSearch(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white w-64 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
            <button
              onClick={fetchUsers}
              className="px-3 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition"
            >
              {usersLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* User table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">User</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Plan</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Events</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Last Active</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => fetchUserDetail(u.id)}
                  className="border-b border-gray-100 hover:bg-teal-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-bold">
                          {(u.display_name || u.email || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="font-medium text-gray-900">{u.display_name || 'No name'}</div>
                        <div className="text-xs text-gray-400">{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      u.plan === 'premium' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {(u.plan || 'free').toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-medium text-gray-900">{u.eventCount}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {u.lastActive ? (
                      <>
                        {new Date(u.lastActive).toLocaleDateString()}{' '}
                        <span className="text-gray-300">{new Date(u.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {u.lastEventType && (
                          <span className="ml-1">{EVENT_ICONS[u.lastEventType] || ''}</span>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && !usersLoading && (
            <div className="text-center py-8 text-gray-400 text-sm">
              {usersSearch ? 'No users match your search' : 'No users yet'}
            </div>
          )}
        </div>
      </>
    );
  };

  // Dashboard sign-in form state (must be declared before any early returns)
  const [dashEmail, setDashEmail] = useState('');
  const [dashPassword, setDashPassword] = useState('');
  const [dashMode, setDashMode] = useState('signin');
  const [dashError, setDashError] = useState('');
  const [dashMessage, setDashMessage] = useState('');
  const [dashSubmitting, setDashSubmitting] = useState(false);
  const [dashGoogleLoading, setDashGoogleLoading] = useState(false);

  // ==================== AUTH GATE ====================
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    const handleDashEmailSubmit = async (e) => {
      e.preventDefault();
      setDashError('');
      setDashMessage('');
      setDashSubmitting(true);
      try {
        if (dashMode === 'signin') {
          const { error: err } = await signInWithEmail(dashEmail, dashPassword);
          if (err) setDashError(err.message);
        } else {
          const { data, error: err } = await signUpWithEmail(dashEmail, dashPassword);
          if (err) setDashError(err.message);
          else if (data?.user && !data.session) setDashMessage('Check your email for a confirmation link.');
        }
      } catch {
        setDashError('Something went wrong. Please try again.');
      }
      setDashSubmitting(false);
    };

    const handleDashGoogle = async () => {
      setDashGoogleLoading(true);
      setDashError('');
      try {
        const { error: err } = await signInWithGoogle();
        if (err) { setDashError(err.message); setDashGoogleLoading(false); }
      } catch { setDashGoogleLoading(false); }
    };

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🔐</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-500 text-sm mb-6">Sign in with your admin account to continue.</p>

          {/* Google */}
          <button
            onClick={handleDashGoogle}
            disabled={dashGoogleLoading || dashSubmitting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition disabled:opacity-50 mb-4"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            {dashGoogleLoading ? 'Redirecting...' : 'Sign in with Google'}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Email/Password */}
          <form onSubmit={handleDashEmailSubmit} className="space-y-3 mb-4 text-left">
            <input
              type="email"
              placeholder="Email address"
              value={dashEmail}
              onChange={(e) => setDashEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
            />
            <input
              type="password"
              placeholder="Password"
              value={dashPassword}
              onChange={(e) => setDashPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={dashMode === 'signin' ? 'current-password' : 'new-password'}
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition placeholder:text-gray-400"
            />
            {dashError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{dashError}</p>}
            {dashMessage && <p className="text-sm text-teal-700 bg-teal-50 px-3 py-2 rounded-lg">{dashMessage}</p>}
            <button
              type="submit"
              disabled={dashSubmitting || dashGoogleLoading}
              className="w-full py-2.5 px-4 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50"
            >
              {dashSubmitting
                ? (dashMode === 'signin' ? 'Signing in...' : 'Creating account...')
                : (dashMode === 'signin' ? 'Sign In' : 'Create Account')
              }
            </button>
          </form>

          <p className="text-sm text-gray-500">
            {dashMode === 'signin' ? (
              <>Don&apos;t have an account?{' '}<button type="button" onClick={() => { setDashMode('signup'); setDashError(''); setDashMessage(''); }} className="text-teal-600 font-medium hover:underline">Sign Up</button></>
            ) : (
              <>Already have an account?{' '}<button type="button" onClick={() => { setDashMode('signin'); setDashError(''); setDashMessage(''); }} className="text-teal-600 font-medium hover:underline">Sign In</button></>
            )}
          </p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">⛔</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500 text-sm mb-2">
            Signed in as <strong>{user?.email}</strong>
          </p>
          <p className="text-gray-400 text-xs">
            This account does not have admin privileges. Contact the project owner to get access.
          </p>
        </div>
      </div>
    );
  }

  // ==================== MAIN RENDER ====================
  const tabs = [
    { id: 'sessions', label: 'Timeline' },
    { id: 'overview', label: '📊 Overview' },
    { id: 'attribution', label: '🔗 Attribution' },
    { id: 'shares', label: '📤 Shares' },
    { id: 'users', label: '👤 Users' },
    { id: 'features', label: '🎛️ Features' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <img src="/logo.png" alt="" width="28" height="28" />
              Analytics Dashboard
            </h1>
            <p className="text-gray-500 text-sm">Split The Distance &bull; Real-time data from Supabase</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <optgroup label="Live">
                <option value="1m">Last 1 min</option>
                <option value="5m">Last 5 min</option>
                <option value="15m">Last 15 min</option>
                <option value="30m">Last 30 min</option>
              </optgroup>
              <optgroup label="Standard">
                <option value="1h">Last hour</option>
                <option value="24h">Last 24 hours</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="all">All time</option>
              </optgroup>
              <optgroup label="Custom">
                <option value="custom">Custom...</option>
              </optgroup>
            </select>
            {timeRange === 'custom' && (
              <div className="flex items-center gap-1">
                <input type="number" min="1" max="999" value={customValue}
                  onChange={(e) => setCustomValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  <option value="minutes">min</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
            )}
            <button onClick={fetchStats}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition">
              Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-teal-500 text-teal-700'
                  : 'text-gray-500 hover:text-gray-700 hover:border-b-2 hover:border-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <>
            {activeTab === 'overview' && <OverviewTab />}
            {activeTab === 'sessions' && <SessionsTab />}
            {activeTab === 'attribution' && <AttributionTab />}
            {activeTab === 'shares' && <SharesTab />}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'features' && <FeaturesTab />}
          </>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">
          Real-time data from Supabase • Visit with ?_internal=1 to exclude yourself
        </div>
      </div>
    </div>
  );
}
