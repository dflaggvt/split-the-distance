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
  const [topPlaces, setTopPlaces] = useState([]);
  const [topRoutes, setTopRoutes] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [deviceStats, setDeviceStats] = useState([]);
  const [hourlyStats, setHourlyStats] = useState([]);
  const [dailyStats, setDailyStats] = useState([]);
  const [geoStats, setGeoStats] = useState([]);
  const [returnVisitors, setReturnVisitors] = useState([]);
  const [categoryStats, setCategoryStats] = useState([]);

  useEffect(() => {
    fetchStats();
  }, [timeRange]);

  const getTimeFilter = () => {
    const now = new Date();
    switch (timeRange) {
      case '1h': return new Date(now - 60 * 60 * 1000).toISOString();
      case '24h': return new Date(now - 24 * 60 * 60 * 1000).toISOString();
      case '7d': return new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d': return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'all': return '2020-01-01T00:00:00.000Z';
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

    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }

    setLoading(false);
  };

  const StatCard = ({ label, value, subtext, icon }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2">
        {icon && <span className="text-lg">{icon}</span>}
        <span className="text-sm text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-3xl font-bold text-gray-900 mt-1">{value?.toLocaleString?.() ?? value ?? '—'}</div>
      {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
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
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
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
              <StatCard icon="👥" label="Sessions" value={stats?.sessions} />
              <StatCard icon="🔍" label="Searches" value={stats?.externalSearches} />
              <StatCard icon="📍" label="Place Clicks" value={stats?.placeClicks} />
              <StatCard icon="🔗" label="Shares" value={stats?.shares} />
              <StatCard icon="🚀" label="Outbound" value={stats?.outboundClicks} />
              <StatCard 
                icon="📈"
                label="Click Rate" 
                value={stats?.externalSearches > 0 ? `${((stats?.placeClicks / stats?.externalSearches) * 100).toFixed(1)}%` : '—'} 
                subtext="Clicks / Searches"
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
