'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
  LineChart, Line
} from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SB_PROJECT_URL,
  process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
);

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
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
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

  useEffect(() => {
    fetchStats();
  }, [timeRange, customValue, customUnit]);

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

    try {
      // ==================== OVERVIEW DATA ====================
      const [
        { count: totalSearches },
        { count: externalSearches },
        { count: placeClicks },
        { count: shares },
        { count: outboundClicks },
        { count: sessions },
      ] = await Promise.all([
        supabase.from('searches').select('*', { count: 'exact', head: true }).gte('created_at', since),
        supabase.from('searches').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
        supabase.from('place_clicks').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
        supabase.from('shares').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
        supabase.from('outbound_clicks').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
        supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('created_at', since).eq('is_internal', false),
      ]);

      setStats({
        totalSearches: totalSearches || 0,
        externalSearches: externalSearches || 0,
        placeClicks: placeClicks || 0,
        shares: shares || 0,
        outboundClicks: outboundClicks || 0,
        sessions: sessions || 0,
      });

      // Place clicks with categories (unique sessions)
      const { data: placesData } = await supabase
        .from('place_clicks')
        .select('place_name, place_category, session_id')
        .gte('created_at', since)
        .eq('is_internal', false).limit(10000);

      if (placesData) {
        const placeSessionSets = {};
        const catCounts = {};
        placesData.forEach(p => {
          if (!placeSessionSets[p.place_name]) placeSessionSets[p.place_name] = new Set();
          placeSessionSets[p.place_name].add(p.session_id || 'unknown');
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
        .select('from_name, to_name, created_at, session_id')
        .gte('created_at', since)
        .eq('is_internal', false).limit(10000);

      if (routesData) {
        const routeSessionSets = {};
        routesData.forEach(r => {
          const fromShort = r.from_name?.split(',')[0] || 'Unknown';
          const toShort = r.to_name?.split(',')[0] || 'Unknown';
          const route = `${fromShort} → ${toShort}`;
          if (!routeSessionSets[route]) routeSessionSets[route] = new Set();
          routeSessionSets[route].add(r.session_id || 'unknown');
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

    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
    setLoading(false);
  };

  // ==================== COMPONENTS ====================

  const StatCard = ({ label, value, subtext, icon, tooltip }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 group relative">
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        {tooltip && <span className="text-gray-300 cursor-help text-xs">ⓘ</span>}
      </div>
      <div className="text-3xl font-bold text-gray-900 mt-1">{value?.toLocaleString?.() ?? value ?? '—'}</div>
      {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 max-w-xs text-center">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
        </div>
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
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <StatCard icon="👥" label="Sessions" value={stats?.sessions} tooltip="Unique visits to the site." />
        <StatCard icon="🔍" label="Searches" value={stats?.externalSearches} tooltip="Midpoint searches performed." />
        <StatCard icon="📍" label="Place Clicks" value={stats?.placeClicks} tooltip="Clicks on place cards." />
        <StatCard icon="🔗" label="Shares" value={stats?.shares} tooltip="Times users shared results." />
        <StatCard icon="🚀" label="Outbound" value={stats?.outboundClicks} tooltip="Clicks to Google Maps, place sites." />
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

      {/* Daily Trend */}
      {dailyStats.length > 1 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-4">📅 Daily Searches</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={dailyStats} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip />
              <Line type="monotone" dataKey="searches" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
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

  // ==================== MAIN RENDER ====================
  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'attribution', label: '🔗 Attribution' },
    { id: 'shares', label: '📤 Shares' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 Analytics Dashboard</h1>
            <p className="text-gray-500 text-sm">Split The Distance • Real-time data from Supabase</p>
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
            {activeTab === 'attribution' && <AttributionTab />}
            {activeTab === 'shares' && <SharesTab />}
          </>
        )}

        <div className="mt-8 text-center text-xs text-gray-400">
          Real-time data from Supabase • Visit with ?_internal=1 to exclude yourself
        </div>
      </div>
    </div>
  );
}
