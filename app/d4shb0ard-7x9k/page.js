'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SB_PROJECT_URL,
  process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
);

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('24h');
  const [topPlaces, setTopPlaces] = useState([]);
  const [topRoutes, setTopRoutes] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [deviceStats, setDeviceStats] = useState({});
  const [hourlyStats, setHourlyStats] = useState([]);
  const [geoStats, setGeoStats] = useState([]);
  const [returnVisitors, setReturnVisitors] = useState({ new: 0, returning: 0 });

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

  // Parse state/city from location name (e.g., "New York, NY, USA" -> "NY")
  const parseState = (locationName) => {
    if (!locationName) return 'Unknown';
    const parts = locationName.split(',').map(p => p.trim());
    // Try to find state abbreviation (2 letters after city)
    for (const part of parts) {
      if (/^[A-Z]{2}$/.test(part)) return part;
    }
    // Otherwise use the second-to-last part (often city/state)
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

      // Fetch top places
      const { data: placesData } = await supabase
        .from('place_clicks')
        .select('place_name, place_category')
        .gte('created_at', since)
        .eq('is_internal', false);

      if (placesData) {
        const placeCounts = {};
        placesData.forEach(p => {
          placeCounts[p.place_name] = (placeCounts[p.place_name] || 0) + 1;
        });
        const sorted = Object.entries(placeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        setTopPlaces(sorted);
      }

      // Fetch top routes + geo stats
      const { data: routesData } = await supabase
        .from('searches')
        .select('from_name, to_name, created_at')
        .gte('created_at', since)
        .eq('is_internal', false);

      if (routesData) {
        // Top routes
        const routeCounts = {};
        routesData.forEach(r => {
          const route = `${r.from_name} → ${r.to_name}`;
          routeCounts[route] = (routeCounts[route] || 0) + 1;
        });
        const sorted = Object.entries(routeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        setTopRoutes(sorted);

        // Geographic breakdown (states/regions)
        const geoCounts = {};
        routesData.forEach(r => {
          const fromState = parseState(r.from_name);
          const toState = parseState(r.to_name);
          geoCounts[fromState] = (geoCounts[fromState] || 0) + 1;
          if (toState !== fromState) {
            geoCounts[toState] = (geoCounts[toState] || 0) + 1;
          }
        });
        const geoSorted = Object.entries(geoCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);
        setGeoStats(geoSorted);

        // Hourly distribution
        const hourCounts = Array(24).fill(0);
        routesData.forEach(r => {
          const hour = new Date(r.created_at).getHours();
          hourCounts[hour]++;
        });
        setHourlyStats(hourCounts);
      }

      // Device breakdown
      const { data: sessionsData } = await supabase
        .from('sessions')
        .select('device_type, visitor_id')
        .gte('created_at', since)
        .eq('is_internal', false);

      if (sessionsData) {
        const deviceCounts = { mobile: 0, desktop: 0, tablet: 0, unknown: 0 };
        const visitorSessions = {};
        
        sessionsData.forEach(s => {
          const type = s.device_type || 'unknown';
          deviceCounts[type] = (deviceCounts[type] || 0) + 1;
          
          // Track visitor sessions for return visitor calculation
          if (s.visitor_id) {
            visitorSessions[s.visitor_id] = (visitorSessions[s.visitor_id] || 0) + 1;
          }
        });
        
        setDeviceStats(deviceCounts);
        
        // Calculate return vs new visitors
        const visitors = Object.values(visitorSessions);
        const returning = visitors.filter(count => count > 1).length;
        const newVisitors = visitors.filter(count => count === 1).length;
        setReturnVisitors({ new: newVisitors, returning });
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

  const StatCard = ({ label, value, subtext, color = 'teal' }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="text-sm text-gray-500 font-medium">{label}</div>
      <div className={`text-3xl font-bold text-${color}-600 mt-1`}>{value?.toLocaleString?.() ?? value ?? '—'}</div>
      {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
    </div>
  );

  const ProgressBar = ({ label, value, max, color = 'teal' }) => {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 w-20">{label}</span>
        <div className="flex-1 bg-gray-100 rounded-full h-4">
          <div 
            className={`bg-${color}-500 h-4 rounded-full transition-all`} 
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700 w-12 text-right">{value}</span>
      </div>
    );
  };

  const maxDevice = Math.max(...Object.values(deviceStats), 1);
  const maxHour = Math.max(...hourlyStats, 1);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">📊 Analytics Dashboard</h1>
            <p className="text-gray-500 text-sm">Split The Distance</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
            >
              <option value="1h">Last hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All time</option>
            </select>
            <button
              onClick={fetchStats}
              className="px-3 py-2 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700"
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <StatCard label="Sessions" value={stats?.sessions} />
              <StatCard label="Searches" value={stats?.externalSearches} />
              <StatCard label="Place Clicks" value={stats?.placeClicks} />
              <StatCard label="Shares" value={stats?.shares} />
              <StatCard label="Outbound Clicks" value={stats?.outboundClicks} />
              <StatCard 
                label="Click Rate" 
                value={stats?.externalSearches > 0 ? `${((stats?.placeClicks / stats?.externalSearches) * 100).toFixed(1)}%` : '—'} 
                subtext="Clicks / Searches"
              />
            </div>

            {/* Conversion Funnel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">📈 Conversion Funnel</h2>
              <div className="flex items-center justify-between">
                <div className="text-center flex-1">
                  <div className="text-3xl font-bold text-blue-600">{stats?.sessions || 0}</div>
                  <div className="text-sm text-gray-500">Sessions</div>
                </div>
                <div className="text-2xl text-gray-300">→</div>
                <div className="text-center flex-1">
                  <div className="text-3xl font-bold text-teal-600">{stats?.externalSearches || 0}</div>
                  <div className="text-sm text-gray-500">Searches</div>
                  <div className="text-xs text-gray-400">
                    {stats?.sessions > 0 ? `${((stats?.externalSearches / stats?.sessions) * 100).toFixed(0)}%` : '—'}
                  </div>
                </div>
                <div className="text-2xl text-gray-300">→</div>
                <div className="text-center flex-1">
                  <div className="text-3xl font-bold text-orange-600">{stats?.placeClicks || 0}</div>
                  <div className="text-sm text-gray-500">Place Clicks</div>
                  <div className="text-xs text-gray-400">
                    {stats?.externalSearches > 0 ? `${((stats?.placeClicks / stats?.externalSearches) * 100).toFixed(0)}%` : '—'}
                  </div>
                </div>
                <div className="text-2xl text-gray-300">→</div>
                <div className="text-center flex-1">
                  <div className="text-3xl font-bold text-purple-600">{stats?.outboundClicks || 0}</div>
                  <div className="text-sm text-gray-500">Outbound</div>
                  <div className="text-xs text-gray-400">
                    {stats?.placeClicks > 0 ? `${((stats?.outboundClicks / stats?.placeClicks) * 100).toFixed(0)}%` : '—'}
                  </div>
                </div>
              </div>
            </div>

            {/* Three Column Layout */}
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              {/* Device Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">📱 Device Breakdown</h2>
                <div className="space-y-3">
                  <ProgressBar label="Mobile" value={deviceStats.mobile || 0} max={maxDevice} color="blue" />
                  <ProgressBar label="Desktop" value={deviceStats.desktop || 0} max={maxDevice} color="green" />
                  <ProgressBar label="Tablet" value={deviceStats.tablet || 0} max={maxDevice} color="purple" />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Mobile %</span>
                    <span className="font-medium">
                      {(deviceStats.mobile + deviceStats.desktop + deviceStats.tablet) > 0
                        ? `${((deviceStats.mobile / (deviceStats.mobile + deviceStats.desktop + deviceStats.tablet)) * 100).toFixed(0)}%`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Return Visitors */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">🔄 Visitor Types</h2>
                <div className="space-y-3">
                  <ProgressBar label="New" value={returnVisitors.new} max={Math.max(returnVisitors.new, returnVisitors.returning, 1)} color="teal" />
                  <ProgressBar label="Returning" value={returnVisitors.returning} max={Math.max(returnVisitors.new, returnVisitors.returning, 1)} color="orange" />
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Return Rate</span>
                    <span className="font-medium">
                      {(returnVisitors.new + returnVisitors.returning) > 0
                        ? `${((returnVisitors.returning / (returnVisitors.new + returnVisitors.returning)) * 100).toFixed(0)}%`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Geographic Breakdown */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">🗺️ Top Regions</h2>
                {geoStats.length > 0 ? (
                  <div className="space-y-2">
                    {geoStats.slice(0, 6).map(([region, count], i) => (
                      <div key={region} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 truncate">
                          <span className="text-gray-400 mr-2">{i + 1}.</span>
                          {region}
                        </span>
                        <span className="text-sm font-medium text-teal-600">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No data yet</p>
                )}
              </div>
            </div>

            {/* Hourly Activity Chart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
              <h2 className="font-semibold text-gray-900 mb-4">⏰ Searches by Hour (UTC)</h2>
              <div className="flex items-end gap-1 h-32">
                {hourlyStats.map((count, hour) => (
                  <div key={hour} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-teal-500 rounded-t transition-all hover:bg-teal-600"
                      style={{ height: `${maxHour > 0 ? (count / maxHour) * 100 : 0}%`, minHeight: count > 0 ? '4px' : '0' }}
                      title={`${hour}:00 - ${count} searches`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-400">
                <span>12am</span>
                <span>6am</span>
                <span>12pm</span>
                <span>6pm</span>
                <span>11pm</span>
              </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Top Places */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">🏆 Top Places Clicked</h2>
                {topPlaces.length > 0 ? (
                  <div className="space-y-2">
                    {topPlaces.map(([name, count], i) => (
                      <div key={name} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 truncate">
                          <span className="text-gray-400 mr-2">{i + 1}.</span>
                          {name}
                        </span>
                        <span className="text-sm font-medium text-teal-600">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No data yet</p>
                )}
              </div>

              {/* Top Routes */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="font-semibold text-gray-900 mb-4">🛣️ Top Routes Searched</h2>
                {topRoutes.length > 0 ? (
                  <div className="space-y-2">
                    {topRoutes.map(([route, count], i) => (
                      <div key={route} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700 truncate" style={{maxWidth: '80%'}}>
                          <span className="text-gray-400 mr-2">{i + 1}.</span>
                          {route}
                        </span>
                        <span className="text-sm font-medium text-teal-600">{count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No data yet</p>
                )}
              </div>
            </div>

            {/* Recent Searches */}
            <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-900 mb-4">🕐 Recent Searches</h2>
              {recentSearches.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2">From</th>
                        <th className="pb-2">To</th>
                        <th className="pb-2">Distance</th>
                        <th className="pb-2">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSearches.map((s, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-2 truncate" style={{maxWidth: '200px'}}>{s.from_name}</td>
                          <td className="py-2 truncate" style={{maxWidth: '200px'}}>{s.to_name}</td>
                          <td className="py-2">{s.distance_miles?.toFixed(0)} mi</td>
                          <td className="py-2 text-gray-400">{new Date(s.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400">No searches yet</p>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          Data refreshes on page load • Visit with ?_internal=1 to exclude yourself from tracking
        </div>
      </div>
    </div>
  );
}
