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

export default function AdminDashboard() {
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
  const [cacheStats, setCacheStats] = useState({ uniqueRoutes: 0, repeatSearches: 0, repeatRate: 0, cacheHits: 0, cacheHitRate: 0 });
  const [repeatRoutes, setRepeatRoutes] = useState([]);

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
      // Fetch counts
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

      // Fetch place clicks with categories
      const { data: placesData } = await supabase
        .from('place_clicks')
        .select('place_name, place_category')
        .gte('created_at', since)
        .eq('is_internal', false);

      if (placesData) {
        // Top places
        const placeCounts = {};
        const catCounts = {};
        placesData.forEach(p => {
          placeCounts[p.place_name] = (placeCounts[p.place_name] || 0) + 1;
          const cat = p.place_category || 'Other';
          catCounts[cat] = (catCounts[cat] || 0) + 1;
        });
        setTopPlaces(Object.entries(placeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, value]) => ({ name: name.substring(0, 25), value })));
        
        setCategoryStats(Object.entries(catCounts)
          .sort((a, b) => b[1] - a[1])
          .map(([name, value]) => ({ name, value })));
      }

      // Fetch searches for routes, geo, and time stats
      const { data: routesData } = await supabase
        .from('searches')
        .select('from_name, to_name, created_at')
        .gte('created_at', since)
        .eq('is_internal', false);

      if (routesData) {
        // Top routes
        const routeCounts = {};
        routesData.forEach(r => {
          const fromShort = r.from_name?.split(',')[0] || 'Unknown';
          const toShort = r.to_name?.split(',')[0] || 'Unknown';
          const route = `${fromShort} → ${toShort}`;
          routeCounts[route] = (routeCounts[route] || 0) + 1;
        });
        setTopRoutes(Object.entries(routeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, value]) => ({ name: name.substring(0, 35), value })));

        // Geographic breakdown
        const geoCounts = {};
        routesData.forEach(r => {
          const fromState = parseState(r.from_name);
          const toState = parseState(r.to_name);
          geoCounts[fromState] = (geoCounts[fromState] || 0) + 1;
          if (toState !== fromState) {
            geoCounts[toState] = (geoCounts[toState] || 0) + 1;
          }
        });
        setGeoStats(Object.entries(geoCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([name, value]) => ({ name, value })));

        // Hourly distribution
        const hourCounts = {};
        for (let i = 0; i < 24; i++) hourCounts[i] = 0;
        routesData.forEach(r => {
          const hour = new Date(r.created_at).getUTCHours();
          hourCounts[hour]++;
        });
        setHourlyStats(Object.entries(hourCounts).map(([hour, searches]) => ({
          hour: `${hour}:00`,
          searches
        })));

        // Daily distribution (for 7d and 30d views)
        if (timeRange === '7d' || timeRange === '30d' || timeRange === 'all') {
          const dayCounts = {};
          routesData.forEach(r => {
            const day = new Date(r.created_at).toISOString().split('T')[0];
            dayCounts[day] = (dayCounts[day] || 0) + 1;
          });
          setDailyStats(Object.entries(dayCounts)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, searches]) => ({
              date: date.substring(5), // MM-DD format
              searches
            })));
        } else {
          setDailyStats([]);
        }
      }

      // Device breakdown
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('device_type, visitor_id')
        .gte('created_at', since)
        .eq('is_internal', false);

      if (sessionsData) {
        const deviceCounts = { Mobile: 0, Desktop: 0, Tablet: 0 };
        const visitorSessions = {};
        
        sessionsData.forEach(s => {
          const type = s.device_type === 'mobile' ? 'Mobile' : 
                       s.device_type === 'desktop' ? 'Desktop' : 
                       s.device_type === 'tablet' ? 'Tablet' : 'Desktop';
          deviceCounts[type]++;
          
          if (s.visitor_id) {
            visitorSessions[s.visitor_id] = (visitorSessions[s.visitor_id] || 0) + 1;
          }
        });
        
        setDeviceStats(Object.entries(deviceCounts)
          .filter(([_, v]) => v > 0)
          .map(([name, value]) => ({ name, value })));
        
        const visitors = Object.values(visitorSessions);
        const returning = visitors.filter(count => count > 1).length;
        const newVisitors = visitors.filter(count => count === 1).length;
        setReturnVisitors([
          { name: 'New', value: newVisitors },
          { name: 'Returning', value: returning }
        ].filter(d => d.value > 0));
      }

      // Fetch recent searches
      const { data: recentData } = await supabase
        .from('searches')
        .select('from_name, to_name, distance_miles, created_at')
        .eq('is_internal', false)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentSearches(recentData || []);

      // Cache efficiency stats - analyze repeat routes and actual cache hits
      if (routesData && routesData.length > 0) {
        const routeMap = {};
        routesData.forEach(r => {
          const key = `${r.from_name}|||${r.to_name}`;
          routeMap[key] = (routeMap[key] || 0) + 1;
        });
        
        const uniqueRoutes = Object.keys(routeMap).length;
        const totalSearches = routesData.length;
        const repeatSearches = totalSearches - uniqueRoutes;
        const repeatRate = totalSearches > 0 ? (repeatSearches / totalSearches * 100) : 0;
        
        // Fetch actual cache hit stats
        const { count: cacheHitCount } = await supabase
          .from('searches')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since)
          .eq('is_internal', false)
          .eq('cache_hit', true);
        
        const cacheHits = cacheHitCount || 0;
        const cacheHitRate = totalSearches > 0 ? (cacheHits / totalSearches * 100) : 0;
        
        setCacheStats({
          uniqueRoutes,
          repeatSearches,
          repeatRate: repeatRate.toFixed(1),
          potentialSavings: (repeatSearches * 0.20).toFixed(2),
          cacheHits,
          cacheHitRate: cacheHitRate.toFixed(1),
          actualSavings: (cacheHits * 0.20).toFixed(2), // Actual savings from cache hits
        });
        
        // Top repeated routes
        const repeats = Object.entries(routeMap)
          .filter(([_, count]) => count > 1)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([key, count]) => {
            const [from, to] = key.split('|||');
            const fromShort = from?.split(',')[0] || 'Unknown';
            const toShort = to?.split(',')[0] || 'Unknown';
            return { route: `${fromShort} → ${toShort}`, count };
          });
        
        setRepeatRoutes(repeats);
      }

    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }

    setLoading(false);
  };

  const StatCard = ({ label, value, subtext, icon, tooltip }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 group relative">
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-sm text-gray-500 font-medium">{label}</span>
        {tooltip && (
          <span className="text-gray-300 cursor-help text-xs">ⓘ</span>
        )}
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={customValue}
                  onChange={(e) => setCustomValue(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                />
                <select
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="px-2 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="minutes">min</option>
                  <option value="hours">hours</option>
                  <option value="days">days</option>
                </select>
              </div>
            )}
            <button
              onClick={fetchStats}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              <StatCard 
                icon="👥" 
                label="Sessions" 
                value={stats?.sessions} 
                tooltip="Unique visits to the site. A session starts when someone opens the page."
              />
              <StatCard 
                icon="🔍" 
                label="Searches" 
                value={stats?.externalSearches} 
                tooltip="Midpoint searches performed. Each 'Find Midpoint' click = 1 search."
              />
              <StatCard 
                icon="📍" 
                label="Place Clicks" 
                value={stats?.placeClicks} 
                tooltip="Clicks on place cards in the results list (restaurants, cafes, etc)."
              />
              <StatCard 
                icon="🔗" 
                label="Shares" 
                value={stats?.shares} 
                tooltip="Times users clicked 'Share' or 'Copy Link' to share results."
              />
              <StatCard 
                icon="🚀" 
                label="Outbound" 
                value={stats?.outboundClicks} 
                tooltip="Clicks to external sites — Google Maps directions, place websites, etc."
              />
              <StatCard 
                icon="📈"
                label="Click Rate" 
                value={stats?.externalSearches > 0 ? `${((stats?.placeClicks / stats?.externalSearches) * 100).toFixed(1)}%` : '—'} 
                subtext="Clicks / Searches"
                tooltip="% of searches that resulted in at least one place click."
              />
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
                    {funnelData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="flex justify-between mt-2 text-xs text-gray-500 px-20">
                <span>Sessions → Searches: {stats?.sessions > 0 ? `${((stats?.externalSearches / stats?.sessions) * 100).toFixed(0)}%` : '—'}</span>
                <span>Searches → Clicks: {stats?.externalSearches > 0 ? `${((stats?.placeClicks / stats?.externalSearches) * 100).toFixed(0)}%` : '—'}</span>
                <span>Clicks → Outbound: {stats?.placeClicks > 0 ? `${((stats?.outboundClicks / stats?.placeClicks) * 100).toFixed(0)}%` : '—'}</span>
              </div>
            </div>

            {/* Cache Efficiency - Cost Optimization */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">💰 Route Caching (Cost Savings)</h2>
              
              {/* Actual Cache Performance */}
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">📊 Actual Cache Performance</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">{cacheStats.cacheHits?.toLocaleString() || 0}</div>
                    <div className="text-xs text-blue-700">Cache Hits</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-blue-600">{cacheStats.cacheHitRate || 0}%</div>
                    <div className="text-xs text-blue-700">Hit Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">${cacheStats.actualSavings || '0.00'}</div>
                    <div className="text-xs text-green-700">Actual Savings</div>
                  </div>
                </div>
              </div>
              
              {/* Potential Analysis */}
              <h3 className="text-sm font-medium text-gray-700 mb-2">📈 Repeat Route Analysis</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-gray-900">{cacheStats.uniqueRoutes.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Unique Routes</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-orange-500">{cacheStats.repeatSearches.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">Repeat Searches</div>
                </div>
                <div className="text-center p-2 bg-gray-50 rounded-lg">
                  <div className="text-lg font-bold text-teal-600">{cacheStats.repeatRate}%</div>
                  <div className="text-xs text-gray-500">Repeat Rate</div>
                </div>
                <div className="text-center p-2 bg-amber-50 rounded-lg">
                  <div className="text-lg font-bold text-amber-600">${cacheStats.potentialSavings}</div>
                  <div className="text-xs text-amber-700">Max Potential</div>
                </div>
              </div>
              {repeatRoutes.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">🔄 Top Repeated Routes</h3>
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
              <div className="mt-3 text-xs text-gray-400">
                Savings = $0.20/cached search (Routes API). Cache TTL: 4 hours.
              </div>
            </div>

            {/* Hourly Activity Chart */}
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

            {/* Daily Trend (for 7d+) */}
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
              {/* Device Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">📱 Devices</h2>
                {deviceStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={deviceStats} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                        {deviceStats.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-gray-400 text-center py-8">No data</p>}
              </div>

              {/* Return Visitors */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">🔄 Visitors</h2>
                {returnVisitors.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={returnVisitors} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                        {returnVisitors.map((_, index) => (
                          <Cell key={index} fill={index === 0 ? '#0d9488' : '#f97316'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-gray-400 text-center py-8">No data yet</p>}
              </div>

              {/* Categories */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">🏷️ Categories</h2>
                {categoryStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={categoryStats.slice(0, 5)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2}>
                        {categoryStats.slice(0, 5).map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-gray-400 text-center py-8">No data</p>}
              </div>

              {/* Regions */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">🗺️ Top Regions</h2>
                {geoStats.length > 0 ? (
                  <div className="space-y-2">
                    {geoStats.slice(0, 6).map((item, i) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">
                          <span className="text-gray-400 mr-2">{i + 1}.</span>{item.name}
                        </span>
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
                      <Tooltip />
                      <Bar dataKey="value" fill="#0d9488" radius={[0, 4, 4, 0]} />
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
                      <Tooltip />
                      <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p className="text-sm text-gray-400 text-center py-8">No data yet</p>}
              </div>
            </div>

            {/* Recent Searches Table */}
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
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No searches yet</p>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          Real-time data from Supabase • Visit with ?_internal=1 to exclude yourself
        </div>
      </div>
    </div>
  );
}
