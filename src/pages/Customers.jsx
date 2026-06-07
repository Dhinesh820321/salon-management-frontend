import { useState, useEffect, useCallback } from 'react';
import { customersAPI, branchesAPI } from '../services/api';
import { formatDate, isValidDate, getDaysSinceVisit, formatCurrency, exportToPDF } from '../utils/helpers';
import { User, AlertTriangle, Search, Phone, Star, Calendar, Loader2, Plus, ChevronLeft, ChevronRight, FileDown, Building2, ChevronDown } from 'lucide-react';

const DEFAULT_CUSTOMERS = [];
const ITEMS_PER_PAGE = 10;

const hasValidLastVisit = (customer) => {
  return customer.last_visit && 
         customer.last_visit !== null && 
         customer.last_visit !== undefined && 
         customer.last_visit !== '' && 
         customer.last_visit !== 'null' &&
         isValidDate(customer.last_visit);
};

const isNewCustomer = (customer) => {
  return !hasValidLastVisit(customer);
};

const getCustomerStatus = (customer) => {
  // Calculate days since visit (use backend value or calculate client-side)
  const daysSinceVisit = customer.days_since_visit ?? getDaysSinceVisit(customer.last_visit);
  
  // RULE 1: "New" - Never had a visit (last_visit is null/undefined)
  if (!hasValidLastVisit(customer)) {
    return 'new';
  }
  
  // RULE 2: "At Risk" - Had visits but last visit > 45 days ago
  if (daysSinceVisit !== null && daysSinceVisit > 45) {
    return 'atRisk';
  }
  
  // RULE 3: "Active" - Last visit within 45 days (30-45 days = still active, just warning could be shown)
  if (daysSinceVisit !== null && daysSinceVisit <= 45) {
    return 'active';
  }
  
  // Fallback: has valid last_visit but no days calculation
  if (hasValidLastVisit(customer)) {
    return 'active';
  }
  
  return 'new';
};

export default function Customers() {
  const [customers, setCustomers] = useState(DEFAULT_CUSTOMERS);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRetention, setShowRetention] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({ total: 0, new: 0, atRisk: 0, active: 0 });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [exporting, setExporting] = useState(false);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(true);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (showRetention) params.retention_alert = true;
      if (selectedBranch) params.branchId = selectedBranch;
      const res = await customersAPI.getAll(params);
      if (res?.data?.success && Array.isArray(res.data.data)) {
        setCustomers(res.data.data);
        const total = res.data.data.length;
        setPagination(prev => ({
          ...prev,
          total,
          totalPages: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
        }));
        
        const newCustomers = res.data.data.filter(c => getCustomerStatus(c) === 'new').length;
        const active = res.data.data.filter(c => getCustomerStatus(c) === 'active').length;
        const atRisk = res.data.data.filter(c => getCustomerStatus(c) === 'atRisk').length;
        
        setStats({
          total: res.data.data.length,
          new: newCustomers,
          atRisk,
          active
        });
        
        console.log('📊 Customer Status Debug:', {
          total: res.data.data.length,
          new: res.data.data.filter(c => getCustomerStatus(c) === 'new').length,
          active: active,
          atRisk: atRisk,
          customers: res.data.data.map(c => ({
            name: c.name,
            phone: c.phone,
            visit_count: c.visit_count,
            loyalty_points: c.loyalty_points,
            last_visit: c.last_visit,
            days_since_visit: c.days_since_visit ?? getDaysSinceVisit(c.last_visit),
            status: getCustomerStatus(c)
          }))
        });
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
      setError(err.response?.data?.message || 'Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [showRetention, selectedBranch]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setLoadingBranches(true);
        const res = await branchesAPI.getAll();
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setBranches(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load branches:', err);
      } finally {
        setLoadingBranches(false);
      }
    };
    loadBranches();
  }, []);

  const filteredCustomers = customers.filter(c =>
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone || '').includes(searchTerm)
  );

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const pages = [];
    const total = pagination.totalPages;
    const current = pagination.page;
    
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      if (current <= 3) {
        pages.push(1, 2, 3, 4, '...', total);
      } else if (current >= total - 2) {
        pages.push(1, '...', total - 3, total - 2, total - 1, total);
      } else {
        pages.push(1, '...', current - 1, current, current + 1, '...', total);
      }
    }
    return pages;
  };

  const paginatedCustomers = filteredCustomers.slice((pagination.page - 1) * ITEMS_PER_PAGE, pagination.page * ITEMS_PER_PAGE);

  const handleExportPDF = () => {
    setExporting(true);
    try {
      const columns = [
        { key: 'name', header: 'Name' },
        { key: 'phone', header: 'Phone' },
        { 
          key: 'last_visit', 
          header: 'Last Visit', 
          format: (val) => hasValidLastVisit({ last_visit: val }) ? formatDate(val) : 'New Customer'
        },
        { key: 'visit_count', header: 'Visits' },
        { key: 'loyalty_points', header: 'Loyalty Points' },
        { 
          key: 'status', 
          header: 'Status', 
          format: (_, item) => getCustomerStatus(item).charAt(0).toUpperCase() + getCustomerStatus(item).slice(1)
        },
      ];
      
      const totalLoyaltyPoints = filteredCustomers.reduce((sum, c) => sum + (c.loyalty_points || 0), 0);
      
      exportToPDF({
        title: 'Customers Report',
        data: filteredCustomers,
        columns,
        filename: 'customers',
        footerData: {
          totalCount: filteredCustomers.length,
          totalCustomers: filteredCustomers.length
        }
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading customers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Catalog</h1>
          <p className="text-gray-600">Manage your customer database</p>
        </div>
        <button 
          onClick={handleExportPDF} 
          disabled={exporting || filteredCustomers.length === 0}
          className="btn-secondary flex items-center gap-2"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
          Export PDF
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <div className="w-12 h-12 mx-auto bg-primary-100 rounded-full flex items-center justify-center mb-3">
            <User className="w-6 h-6 text-primary-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.total}</h3>
          <p className="text-gray-600 text-sm">Total Customers</p>
        </div>
        <div className="card text-center">
          <div className="w-12 h-12 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-3">
            <Plus className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-2xl font-bold text-blue-600">{stats.new}</h3>
          <p className="text-gray-600 text-sm">New Customers</p>
        </div>
        <div className="card text-center">
          <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-3">
            <Star className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-green-600">{stats.active}</h3>
          <p className="text-gray-600 text-sm">Active (30 days)</p>
        </div>
        <div className="card text-center">
          <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-red-600">{stats.atRisk}</h3>
          <p className="text-gray-600 text-sm">At Risk (45+ days)</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              id="customerSearch"
              name="customerSearch"
              type="text"
              placeholder="Search by name or phone..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="input pl-10 w-full"
            />
          </div>
          <div className="relative min-w-[200px]">
            <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              id="branchFilter"
              name="branchFilter"
              value={selectedBranch}
              onChange={(e) => { setSelectedBranch(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
              className="input pl-10 w-full appearance-none bg-white pr-10"
              disabled={loadingBranches}
            >
              <option value="">All Branches</option>
              {branches.map(branch => (
                <option key={branch._id || branch.id} value={branch._id || branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          </div>
          <button
            onClick={() => setShowRetention(!showRetention)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${showRetention ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}
          >
            <AlertTriangle className="w-4 h-4" />
            Retention Alerts
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Phone</th>
                {!selectedBranch && <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Branch</th>}
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Last Visit</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Loyalty Points</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={selectedBranch ? 5 : 6} className="px-4 py-8 text-center text-gray-500">
                    <User className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>{searchTerm ? 'No customers match your search.' : 'No customers found.'}</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-blue-600" />
                        </div>
                        <span className="font-medium text-gray-900">{customer.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-4 h-4 text-gray-400" />
                        {customer.phone}
                      </div>
                    </td>
                    {!selectedBranch && (
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {customer.branch_name || 'N/A'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        {hasValidLastVisit(customer) ? (
                          <>
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <span className={customer.days_since_visit > 45 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                              {formatDate(customer.last_visit)}
                            </span>
                          </>
                        ) : (
                          <span className="text-blue-600">New Customer</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className="text-gray-600">{customer.loyalty_points || 0}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getCustomerStatus(customer) === 'new' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          New
                        </span>
                      ) : getCustomerStatus(customer) === 'atRisk' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          At Risk
                        </span>
                      ) : getCustomerStatus(customer) === 'inactive' ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          Inactive
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredCustomers.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{(pagination.page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-medium">{Math.min(pagination.page * ITEMS_PER_PAGE, filteredCustomers.length)}</span> of{' '}
              <span className="font-medium">{filteredCustomers.length}</span> results
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              {getPageNumbers().map((page, idx) => (
                page === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`min-w-[36px] h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      pagination.page === page
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {page}
                  </button>
                )
              ))}
              
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
