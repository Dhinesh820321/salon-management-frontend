import { useState, useEffect, useRef, useCallback } from 'react';
import { dashboardAPI, branchesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { cleanParams } from '../utils/cleanParams';
import { formatCurrency, formatNumber } from '../utils/helpers';
import {
  TrendingUp, TrendingDown, Users, CreditCard, Calendar,
  Package, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0ea5e9', '#22c55e', '#a855f7'];

const defaultDashboard = {
  today: {
    revenue: 0,
    collection: 0,
    upiCollection: 0,
    cashCollection: 0,
    invoices: 0,
    attendance: { total: 0, checkedIn: 0 }
  },
  month: { revenue: 0 },
  totals: { lowStockItems: 0, retentionAlerts: 0, totalCustomers: 0 },
  alerts: {
    lowStock: [],
    retention: []
  }
};

const defaultChartData = [];

const getLocalDateString = () => {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
};

export default function Dashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(defaultDashboard);
  const [chartData, setChartData] = useState(defaultChartData);
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [chartRange, setChartRange] = useState('week');
  const branchRef = useRef('');
  const isInitialMount = useRef(true);

  const fetchDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }
    
    try {
      const currentBranch = branchRef.current;
      const params = cleanParams({ branch_id: currentBranch || undefined });
      
      console.log('📊 Fetching Dashboard - Branch:', currentBranch || 'All');
      
      const [dashRes, trendRes, branchRes] = await Promise.all([
        dashboardAPI.getDashboard(params),
        dashboardAPI.getRevenueTrend({ ...params, range: chartRange }),
        branchesAPI.getAll()
      ]);
      
      if (dashRes?.data?.success) {
        setDashboard(dashRes.data.data || defaultDashboard);
      }
      
      if (trendRes?.data?.success) {
        const trendData = trendRes.data.data || [];
        console.log('📈 Revenue Trend Data:', trendData.length, 'records');
        setChartData(trendData);
      }
      
      if (branchRes?.data?.success) {
        setBranches(Array.isArray(branchRes.data.data) ? branchRes.data.data : []);
      }
    } catch (error) {
      console.error('Dashboard error:', error);
    }
    
    if (showLoading) {
      setLoading(false);
    }
  }, [chartRange]);

  useEffect(() => {
    branchRef.current = selectedBranch;
    
    if (isInitialMount.current) {
      isInitialMount.current = false;
      fetchDashboard(true);
    } else {
      fetchDashboard(false);
    }
    
    const interval = setInterval(() => fetchDashboard(false), 60000);
    
    return () => {
      clearInterval(interval);
    };
  }, [selectedBranch, chartRange, fetchDashboard]);

  const handleBranchChange = (e) => {
    setSelectedBranch(e.target.value);
  };

  const handleRefresh = () => {
    fetchDashboard(true);
  };

  const handleRangeChange = (range) => {
    setChartRange(range);
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const pieData = [
    { name: 'UPI', value: dashboard?.today?.upiCollection || 0 },
    { name: 'Cash', value: dashboard?.today?.cashCollection || 0 }
  ].filter(d => d.value > 0);

  const chartHasData = chartData.length > 0 && chartData.some(d => d.revenue > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user?.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {user?.role === 'admin' && branches.length > 0 && (
            <select
              value={selectedBranch}
              onChange={handleBranchChange}
              className="input w-auto"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(dashboard?.today?.revenue || 0)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" />
            {dashboard?.today?.invoices || 0} invoices today
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Today's Collection</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(dashboard?.today?.collection || 0)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            UPI: {formatCurrency(dashboard?.today?.upiCollection || 0)} | Cash: {formatCurrency(dashboard?.today?.cashCollection || 0)}
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(dashboard?.month?.revenue || 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            This month so far
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Attendance Today</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {dashboard?.today?.attendance?.checkedIn || 0}
              </p>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl">
              <Calendar className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Out of {dashboard?.today?.attendance?.total || 0} employees
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Trend</h3>
            <div className="flex gap-2">
              <button
                onClick={() => handleRangeChange('week')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  chartRange === 'week' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Week
              </button>
              <button
                onClick={() => handleRangeChange('month')}
                className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                  chartRange === 'month' 
                    ? 'bg-primary-100 text-primary-700' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Month
              </button>
            </div>
          </div>
          <div className="h-80">
            {loading && chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : chartHasData ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getDate()}/${date.getMonth() + 1}`;
                    }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `Rs.${(value/1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value) => formatCurrency(value)}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0ea5e9"
                    strokeWidth={2}
                    fill="url(#colorRevenue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <TrendingUp className="w-12 h-12 text-gray-300 mb-2" />
                <p>No revenue data available</p>
                <p className="text-sm">Data will appear after first invoice</p>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Split</h3>
          <div className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                <CreditCard className="w-8 h-8 text-gray-300" />
                <p className="ml-2">No payments yet</p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-4 mt-4">
            {pieData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index] }} />
                <span className="text-sm text-gray-600">{entry.name}: {formatCurrency(entry.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {dashboard?.alerts?.lowStock?.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
            </div>
            <div className="space-y-3">
              {dashboard.alerts.lowStock.map((item) => (
                <div key={item.id || item._id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{item.item_name}</p>
                    <p className="text-sm text-gray-500">{item.branch_name || item.branch?.name}</p>
                  </div>
                  <span className="text-red-600 font-semibold">
                    {item.remaining_quantity} left
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {dashboard?.alerts?.retention?.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-yellow-500" />
              <h3 className="text-lg font-semibold text-gray-900">Retention Alerts</h3>
            </div>
            <div className="space-y-3">
              {dashboard.alerts.retention.map((customer) => (
                <div key={customer.id || customer._id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{customer.name}</p>
                    <p className="text-sm text-gray-500">{customer.phone}</p>
                  </div>
                  <span className="text-yellow-600 font-medium">
                    {customer.days_since_visit} days ago
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
