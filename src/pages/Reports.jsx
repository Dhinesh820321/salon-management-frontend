import { useState, useEffect } from 'react';
import { reportsAPI, branchesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { cleanParams } from '../utils/cleanParams';
import { formatCurrency, exportToPDF } from '../utils/helpers';
import { FileText, FileDown, TrendingUp, Users, Calendar, Building2, Loader2, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const DEFAULT_BRANCHES = [];

export default function Reports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('daily');
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [filters, setFilters] = useState({
    date: new Date().toISOString().split('T')[0],
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1,
    branch_id: '',
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  const [reportData, setReportData] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadBranches();
  }, []);

  useEffect(() => {
    loadReport();
  }, [reportType, filters.branch_id, filters.date, filters.year, filters.month, filters.start_date, filters.end_date]);

  const loadBranches = async () => {
    try {
      const res = await branchesAPI.getAll();
      if (res?.data?.success && Array.isArray(res.data.data)) {
        setBranches(res.data.data);
      }
    } catch (error) { 
      console.error('Branches Error:', error); 
    }
  };

  const loadReport = async () => {
    setLoading(true);
    setReportData(null);
    try {
      let res;
      const params = cleanParams({ 
        branch_id: filters.branch_id || undefined,
        date: reportType === 'daily' ? filters.date : undefined,
        year: reportType === 'monthly' ? filters.year : undefined,
        month: reportType === 'monthly' ? filters.month : undefined,
        start_date: ['branch', 'employee'].includes(reportType) ? filters.start_date : undefined,
        end_date: ['branch', 'employee'].includes(reportType) ? filters.end_date : undefined
      });

      console.log('📊 Loading Report:', reportType, params);

      if (reportType === 'daily') {
        res = await reportsAPI.getDailyReport(params);
      } else if (reportType === 'monthly') {
        res = await reportsAPI.getMonthlyReport(params);
      } else if (reportType === 'branch') {
        res = await reportsAPI.getBranchPerformance(params);
      } else if (reportType === 'employee') {
        res = await reportsAPI.getEmployeePerformance(params);
      }

      if (res?.data?.success) {
        console.log('📊 Report Data:', reportType, JSON.stringify(res.data.data).substring(0, 500));
        setReportData(res.data.data);
      } else {
        console.error('📊 API Error:', res?.data);
      }
    } catch (error) { 
      console.error('Report Error:', error); 
    }
    setLoading(false);
  };

  const handleExportPDF = async () => {
    if (reportType === 'employee' && reportData?.employees) {
      exportToPDF({
        title: 'Employee Performance Report',
        data: reportData.employees,
        filename: 'employee-report',
        reportType: 'employee',
        tableColumns: ['#', 'Name', 'Branch', 'Services', 'Revenue']
      });
      return;
    }
    
    if (!reportType || (reportType !== 'daily' && reportType !== 'monthly')) {
      alert('PDF export is available for Daily and Monthly reports only.');
      return;
    }
    
    setExporting(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
      const token = localStorage.getItem('token');

      const requestBody = {
        type: reportType,
        branchId: filters.branch_id || null
      };

      if (reportType === 'daily') {
        requestBody.date = filters.date;
      } else if (reportType === 'monthly') {
        requestBody.year = filters.year;
        requestBody.month = filters.month;
      }

      console.log('Exporting PDF:', requestBody);

      const response = await fetch(`${API_URL}/reports/export-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      const filename = reportType === 'daily' 
        ? `daily-report-${filters.date}.pdf`
        : `monthly-report-${filters.year}-${filters.month}.pdf`;
      
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('PDF Export Error:', error);
      alert('Failed to export PDF. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b._id === branchId);
    return branch?.name || 'All Branches';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600">Generate and analyze business reports</p>
        </div>
        <button 
          onClick={handleExportPDF} 
          disabled={exporting || !reportData || !['daily', 'monthly', 'employee'].includes(reportType)}
          className="btn-secondary flex items-center gap-2"
          title={!['daily', 'monthly', 'employee'].includes(reportType) ? 'PDF export available for Daily, Monthly and Employee reports' : ''}
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
          Export PDF
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { id: 'daily', label: 'Daily', icon: Calendar },
          { id: 'monthly', label: 'Monthly', icon: FileText },
          { id: 'branch', label: 'Branch', icon: Building2, adminOnly: true },
          { id: 'employee', label: 'Employee', icon: Users }
        ].map(tab => (
          (!tab.adminOnly || user?.role === 'admin') && (
            <button
              key={tab.id}
              onClick={() => setReportType(tab.id)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                reportType === tab.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          )
        ))}
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-4 mb-6">
          {reportType === 'daily' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Select Date</label>
              <input 
                type="date" 
                value={filters.date} 
                onChange={(e) => setFilters({...filters, date: e.target.value})} 
                className="input w-auto" 
              />
            </div>
          )}
          
          {reportType === 'monthly' && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Year</label>
                <select 
                  value={filters.year} 
                  onChange={(e) => setFilters({...filters, year: parseInt(e.target.value)})} 
                  className="input w-auto"
                >
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">Month</label>
                <select 
                  value={filters.month} 
                  onChange={(e) => setFilters({...filters, month: parseInt(e.target.value)})} 
                  className="input w-auto"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                    <option key={m} value={m}>
                      {new Date(2024, m - 1).toLocaleString('en', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {(reportType === 'branch' || reportType === 'employee') && (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">From Date</label>
                <input 
                  type="date" 
                  value={filters.start_date} 
                  onChange={(e) => setFilters({...filters, start_date: e.target.value})} 
                  className="input w-auto" 
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500">To Date</label>
                <input 
                  type="date" 
                  value={filters.end_date} 
                  onChange={(e) => setFilters({...filters, end_date: e.target.value})} 
                  className="input w-auto" 
                />
              </div>
            </>
          )}

          {user?.role === 'admin' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Branch</label>
              <select 
                value={filters.branch_id} 
                onChange={(e) => setFilters({...filters, branch_id: e.target.value})} 
                className="input w-auto"
              >
                <option value="">All Branches</option>
                {(branches || []).map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : reportData ? (
          <>
            {reportType === 'daily' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-green-50 rounded-xl">
                    <p className="text-sm text-green-700">Revenue</p>
                    <p className="text-2xl font-bold text-green-900">{formatCurrency(reportData.revenue?.total)}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <p className="text-sm text-blue-700">Invoices</p>
                    <p className="text-2xl font-bold text-blue-900">{reportData.revenue?.count || 0}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-xl">
                    <p className="text-sm text-orange-700">Expenses</p>
                    <p className="text-2xl font-bold text-orange-900">{formatCurrency(reportData.expenses)}</p>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-xl">
                    <p className="text-sm text-purple-700">Net Profit</p>
                    <p className="text-2xl font-bold text-purple-900">{formatCurrency(reportData.summary?.netProfit)}</p>
                  </div>
                </div>
                {reportData.revenue?.total > 0 && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{ name: 'Revenue', value: reportData.revenue?.total }]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="value" fill="#0ea5e9" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {reportType === 'monthly' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="p-4 bg-green-50 rounded-xl">
                    <p className="text-sm text-green-700">Revenue</p>
                    <p className="text-xl font-bold text-green-900">{formatCurrency(reportData.summary?.revenue)}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <p className="text-sm text-blue-700">Invoices</p>
                    <p className="text-xl font-bold text-blue-900">{reportData.summary?.total_invoices || 0}</p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-xl">
                    <p className="text-sm text-orange-700">Expenses</p>
                    <p className="text-xl font-bold text-orange-900">{formatCurrency(reportData.expenses?.total)}</p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-xl">
                    <p className="text-sm text-indigo-700">Profit</p>
                    <p className="text-xl font-bold text-indigo-900">{formatCurrency(reportData.profit)}</p>
                  </div>
                </div>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={reportData.dailyData || []}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {reportType === 'branch' && reportData.branches && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Branch</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Revenue</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Invoices</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Expenses</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Profit</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(reportData.branches || []).map((b) => (
                        <tr key={b.id || b._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{b.name}</td>
                          <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(b.revenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{b.totalInvoices || b.invoices || 0}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(b.expenses)}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-medium">{formatCurrency(b.profit)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{b.profitMargin}%</td>
                        </tr>
                      ))}
                    </tbody>
                    {reportData.totals && (
                      <tfoot className="bg-gray-50 font-semibold">
                        <tr>
                          <td className="px-4 py-3">Total</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(reportData.totals.revenue)}</td>
                          <td className="px-4 py-3 text-right">{reportData.totals.invoices}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(reportData.totals.expenses)}</td>
                          <td className="px-4 py-3 text-right text-green-600">{formatCurrency(reportData.totals.revenue - reportData.totals.expenses)}</td>
                          <td className="px-4 py-3 text-right">-</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {reportData.branches?.length > 0 && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.branches}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="revenue" fill="#0ea5e9" name="Revenue" />
                        <Bar dataKey="profit" fill="#22c55e" name="Profit" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {reportType === 'employee' && reportData.employees && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">#</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Branch</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Services</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Revenue</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Avg/Service</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(reportData.employees || []).map((e, idx) => (
                        <tr key={e.id || e._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-500">{idx + 1}</td>
                          <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                          <td className="px-4 py-3 text-gray-600">{e.branch_name}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{e.totalServices || 0}</td>
                          <td className="px-4 py-3 text-right text-gray-900 font-medium">{formatCurrency(e.revenue)}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(e.avgPerService)}</td>
                        </tr>
                      ))}
                    </tbody>
                    {reportData.totals && (
                      <tfoot className="bg-gray-50 font-semibold">
                        <tr>
                          <td className="px-4 py-3" colSpan={3}>Total</td>
                          <td className="px-4 py-3 text-right">{reportData.totals.services}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(reportData.totals.revenue)}</td>
                          <td className="px-4 py-3 text-right">-</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                {reportData.employees?.length > 0 && (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={reportData.employees.slice(0, 10)} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" tick={{ fontSize: 11 }} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Bar dataKey="revenue" fill="#0ea5e9" name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <FileText className="w-12 h-12 text-gray-300 mb-2" />
            <p>No data available for selected filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
