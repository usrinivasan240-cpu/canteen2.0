import React, { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';

interface DashboardData {
  canteenId: string;
  today: {
    orders: number;
    revenue: number;
    completed: number;
    cancelled: number;
    expired: number;
    avgPrepTimeMinutes: number;
    wasteTotal: number;
  };
  popularItems: Array<{ id: string; name: string; count: number; revenue: number }>;
  counters: Array<any>;
  avgRating: number;
  totalReviews: number;
  totalMenuItems: number;
  totalOrdersAllTime: number;
}

interface WasteSummary {
  totalCost: number;
  totalQuantity: number;
  recordCount: number;
  byReason: Record<string, number>;
  byItem: Array<{ id: string; name: string; quantity: number; cost: number }>;
}

interface Recommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: string;
}

interface Prediction {
  id: string;
  predictionDate: string;
  predictedDemand: any;
  confidence: number;
  generatedAt: number;
}

export default function OwnerDashboard({ canteenId, onLogout }: { canteenId: string; onLogout: () => void }) {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [wasteSummary, setWasteSummary] = useState<WasteSummary | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'waste' | 'ai' | 'counters'>('overview');
  const [generating, setGenerating] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [dashRes, wasteRes, recsRes, predsRes] = await Promise.all([
        fetch(`${API_BASE}/api/owner/dashboard?canteenId=${canteenId}`),
        fetch(`${API_BASE}/api/waste/summary?canteenId=${canteenId}&days=30`),
        fetch(`${API_BASE}/api/recommendations?canteenId=${canteenId}`),
        fetch(`${API_BASE}/api/analytics/predictions?canteenId=${canteenId}`),
      ]);

      const dashData = await dashRes.json();
      if (dashData.success) setDashboard(dashData.dashboard);

      const wasteData = await wasteRes.json();
      if (wasteData.success) setWasteSummary(wasteData.summary);

      const recsData = await recsRes.json();
      if (recsData.success) setRecommendations(recsData.recommendations);

      const predsData = await predsRes.json();
      if (predsData.success) setPredictions(predsData.predictions);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, [canteenId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const generatePredictions = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/generate-predictions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canteenId, daysBack: 7 }),
      });
      const data = await res.json();
      if (data.success) fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const generateRecommendations = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${API_BASE}/api/recommendations/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canteenId }),
      });
      const data = await res.json();
      if (data.success) fetchData();
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading owner dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-20 text-gray-400">
        <p>Failed to load dashboard data.</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-amber-500 text-white rounded-lg text-sm">Retry</button>
      </div>
    );
  }

  const { today, popularItems, avgRating, totalReviews, totalMenuItems, totalOrdersAllTime } = dashboard;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white font-display">Owner Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Analytics, waste tracking & AI insights</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700 transition-colors">
            Refresh
          </button>
          <button onClick={onLogout} className="px-3 py-2 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 transition-colors">
            Logout
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 bg-gray-900 p-1 rounded-xl w-fit">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'waste', label: 'Waste' },
          { key: 'ai', label: 'AI Insights' },
          { key: 'counters', label: 'Counters' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-amber-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Today's Orders" value={today.orders} icon="📋" color="amber" />
            <StatCard label="Revenue" value={`₹${today.revenue}`} icon="💰" color="green" />
            <StatCard label="Completed" value={today.completed} icon="✅" color="blue" />
            <StatCard label="Avg Prep Time" value={`${today.avgPrepTimeMinutes}m`} icon="⏱️" color="purple" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Cancelled" value={today.cancelled} icon="❌" color="red" />
            <StatCard label="Expired" value={today.expired} icon="⏰" color="orange" />
            <StatCard label="Waste Cost" value={`₹${today.wasteTotal}`} icon="🗑️" color="red" />
            <StatCard label="Avg Rating" value={`${avgRating}/5`} icon="⭐" color="yellow" />
          </div>

          {/* Popular Items */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h3 className="text-white font-semibold mb-4">Popular Items Today</h3>
            {popularItems.length === 0 ? (
              <p className="text-gray-500 text-sm">No orders today yet.</p>
            ) : (
              <div className="space-y-3">
                {popularItems.map((item, idx) => (
                  <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 text-sm w-6">#{idx + 1}</span>
                      <span className="text-white text-sm">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400 text-xs">{item.count} orders</span>
                      <span className="text-amber-400 text-sm font-medium">₹{item.revenue}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
              <p className="text-2xl font-bold text-white">{totalMenuItems}</p>
              <p className="text-gray-400 text-xs mt-1">Menu Items</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
              <p className="text-2xl font-bold text-white">{totalReviews}</p>
              <p className="text-gray-400 text-xs mt-1">Reviews</p>
            </div>
            <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 text-center">
              <p className="text-2xl font-bold text-white">{totalOrdersAllTime}</p>
              <p className="text-gray-400 text-xs mt-1">Total Orders</p>
            </div>
          </div>
        </div>
      )}

      {/* Waste Tab */}
      {activeTab === 'waste' && (
        <div className="space-y-6">
          {wasteSummary ? (
            <>
              <div className="grid grid-cols-3 gap-4">
                <StatCard label="Total Waste Cost" value={`₹${wasteSummary.totalCost}`} icon="💸" color="red" />
                <StatCard label="Items Wasted" value={wasteSummary.totalQuantity} icon="📦" color="orange" />
                <StatCard label="Records" value={wasteSummary.recordCount} icon="📝" color="gray" />
              </div>

              {/* By Reason */}
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h3 className="text-white font-semibold mb-4">Waste by Reason</h3>
                {Object.keys(wasteSummary.byReason).length === 0 ? (
                  <p className="text-gray-500 text-sm">No waste recorded in the last 30 days.</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(wasteSummary.byReason).map(([reason, cost]) => (
                      <div key={reason} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <span className="text-gray-300 text-sm capitalize">{reason.replace(/_/g, ' ')}</span>
                        <span className="text-red-400 font-medium">₹{cost}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* By Item */}
              <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <h3 className="text-white font-semibold mb-4">Waste by Item</h3>
                {wasteSummary.byItem.length === 0 ? (
                  <p className="text-gray-500 text-sm">No item-level waste data.</p>
                ) : (
                  <div className="space-y-3">
                    {wasteSummary.byItem.map(item => (
                      <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                        <div>
                          <span className="text-gray-300 text-sm">{item.name}</span>
                          <span className="text-gray-500 text-xs ml-2">{item.quantity} units</span>
                        </div>
                        <span className="text-red-400 font-medium">₹{item.cost}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="text-gray-500 text-center py-10">Loading waste data...</p>
          )}
        </div>
      )}

      {/* AI Insights Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* Predictions */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Demand Predictions</h3>
              <button
                onClick={generatePredictions}
                disabled={generating}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Predictions'}
              </button>
            </div>
            {predictions.length === 0 ? (
              <p className="text-gray-500 text-sm">No predictions yet. Click generate to create demand forecasts.</p>
            ) : (
              <div className="space-y-3">
                {predictions.slice(0, 5).map(pred => (
                  <div key={pred.id} className="bg-gray-800 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm">Prediction for {pred.predictionDate}</span>
                      <span className="text-purple-400 text-xs">{Math.round((pred.confidence || 0) * 100)}% confidence</span>
                    </div>
                    <p className="text-gray-400 text-xs mt-1">Generated {new Date(pred.generatedAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">AI Recommendations</h3>
              <button
                onClick={generateRecommendations}
                disabled={generating}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                {generating ? 'Generating...' : 'Generate Recommendations'}
              </button>
            </div>
            {recommendations.length === 0 ? (
              <p className="text-gray-500 text-sm">No recommendations yet. Click generate to get AI-powered suggestions.</p>
            ) : (
              <div className="space-y-3">
                {recommendations.map(rec => (
                  <div key={rec.id} className="bg-gray-800 rounded-lg p-4 border-l-3" style={{ borderLeftColor: getPriorityColor(rec.priority) }}>
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm font-medium">{rec.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${getPriorityClass(rec.priority)}`}>
                        {rec.priority}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs mt-2">{rec.description}</p>
                    <span className="text-gray-500 text-xs mt-1 block capitalize">{rec.type?.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Counters Tab */}
      {activeTab === 'counters' && (
        <div className="space-y-6">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <h3 className="text-white font-semibold mb-4">Counter Workload</h3>
            {dashboard.counters.length === 0 ? (
              <p className="text-gray-500 text-sm">No counter data available.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboard.counters.map((counter: any) => (
                  <div key={counter.id} className="bg-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{counter.counterName || 'Counter'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        counter.status === 'busy' ? 'bg-amber-500/20 text-amber-400' :
                        counter.status === 'idle' ? 'bg-green-500/20 text-green-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {counter.status || 'idle'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span>Assigned: {counter.assignedOrders || 0}</span>
                      <span>Completed: {counter.completedOrders || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: any; icon: string; color: string }) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg">{icon}</span>
      </div>
      <p className="text-white text-xl font-bold">{value}</p>
      <p className="text-gray-400 text-xs mt-1">{label}</p>
    </div>
  );
}

function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high': return '#ef4444';
    case 'medium': return '#f59e0b';
    case 'low': return '#22c55e';
    default: return '#6b7280';
  }
}

function getPriorityClass(priority: string): string {
  switch (priority) {
    case 'high': return 'bg-red-500/20 text-red-400';
    case 'medium': return 'bg-amber-500/20 text-amber-400';
    case 'low': return 'bg-green-500/20 text-green-400';
    default: return 'bg-gray-500/20 text-gray-400';
  }
}
