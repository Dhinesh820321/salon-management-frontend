import { useState, useEffect, useRef } from 'react';
import { paymentsAPI, branchesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { cleanParams } from '../utils/cleanParams';
import { formatCurrency, formatDateTime, getPaymentTypeColor, exportToPDF } from '../utils/helpers';
import { CreditCard, TrendingUp, Calendar, ChevronLeft, ChevronRight, Edit, Trash2, FileDown, Loader2 } from 'lucide-react';

const DEFAULT_PAYMENTS = [];
const DEFAULT_BRANCHES = [];
const DEFAULT_TOTALS = { upi: 0, cash: 0, card: 0, total: 0 };
const ITEMS_PER_PAGE = 10;

export default function Payments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState(DEFAULT_PAYMENTS);
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [totals, setTotals] = useState(DEFAULT_TOTALS);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date: '', branch_id: '', payment_type: '' });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [editingPayment, setEditingPayment] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const isModalOpen = useRef(false);

  useEffect(() => { loadData(); }, [filters]);

  const loadData = async () => {
    try {
      isModalOpen.current = false;
      const params = cleanParams({ ...filters });
      const [payRes, branchRes, totalRes] = await Promise.all([
        paymentsAPI.getAll(params),
        branchesAPI.getAll(),
        paymentsAPI.getDailyTotals({ branch_id: filters.branch_id || user?.branch_id, date: filters.date || new Date().toISOString().split('T')[0] })
      ]);
      if (payRes?.data?.success && Array.isArray(payRes.data.data)) {
        setPayments(payRes.data.data);
        const total = payRes.data.data.length;
        setPagination(prev => ({
          ...prev,
          total,
          totalPages: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
        }));
      }
      if (branchRes?.data?.success && Array.isArray(branchRes.data.data)) {
        setBranches(branchRes.data.data);
      }
      if (totalRes?.data?.success) {
        setTotals(totalRes.data.data);
      }
    } catch (error) { console.error('Error:', error); }
    setLoading(false);
  };

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

  const paginatedPayments = payments.slice((pagination.page - 1) * ITEMS_PER_PAGE, pagination.page * ITEMS_PER_PAGE);

  const handleExportPDF = () => {
    setExporting(true);
    try {
      const selectedBranch = branches.find(b => b._id === filters.branch_id);
      const branchName = selectedBranch?.name || 'All Branches';
      const dateStr = filters.date || new Date().toISOString().split('T')[0];
      const dateRange = `${dateStr}`;
      
      const cashPayments = payments.filter(p => p.payment_type === 'CASH');
      const upiPayments = payments.filter(p => p.payment_type === 'UPI');
      
      const totalCash = cashPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const totalUPI = upiPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const grandTotal = totalCash + totalUPI;
      
      const formatForPDF = (paymentArray) => paymentArray.map(p => [
        formatDateTime(p.created_at),
        p.branch_name || '-',
        p.employee_name || '-',
        p.services && p.services !== 'No Service' ? p.services : 'N/A',
        p.payment_type || '-',
        'Rs. ' + (Number(p.amount) || 0).toFixed(2)
      ]);
      
      exportToPDF({
        title: 'Payment Report',
        data: payments,
        filename: 'payments',
        reportType: 'expenses_summary',
        tableColumns: ['Date', 'Branch', 'Employee', 'Services', 'Type', 'Amount'],
        branchName: branchName,
        dateRange: dateRange,
        sections: {
          cash: {
            title: 'Cash Payments',
            data: formatForPDF(cashPayments),
            total: totalCash
          },
          upi: {
            title: 'UPI Payments',
            data: formatForPDF(upiPayments),
            total: totalUPI
          },
          summary: {
            totalCash,
            totalUPI,
            grandTotal
          }
        }
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">Track all payment collections</p>
        </div>
        <button 
          onClick={handleExportPDF} 
          disabled={exporting || payments.length === 0}
          className="btn-secondary flex items-center gap-2"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
          Export PDF
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-xl">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">UPI</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.upi_total || totals.upi)}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Cash</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.cash_total || totals.cash)}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-xl">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Card</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(totals.card_total || totals.card)}</p>
            </div>
          </div>
        </div>
        <div className="stat-card bg-primary-50 border-primary-100">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-600 rounded-xl">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-primary-700">Total</p>
              <p className="text-xl font-bold text-primary-900">{formatCurrency(totals.total)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative">
            <label htmlFor="paymentDate" className="sr-only">Filter by Date</label>
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="paymentDate" name="date" type="date" value={filters.date} onChange={(e) => { setFilters({...filters, date: e.target.value}); setPagination(prev => ({ ...prev, page: 1 })); }} className="input pl-10" />
          </div>
          {user?.role === 'admin' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="paymentBranch" className="sr-only">Filter by Branch</label>
              <select id="paymentBranch" name="branch_id" value={filters.branch_id} onChange={(e) => { setFilters({...filters, branch_id: e.target.value}); setPagination(prev => ({ ...prev, page: 1 })); }} className="input w-auto">
                <option value="">All Branches</option>
                {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="paymentType" className="sr-only">Filter by Payment Type</label>
            <select id="paymentType" name="payment_type" value={filters.payment_type} onChange={(e) => { setFilters({...filters, payment_type: e.target.value}); setPagination(prev => ({ ...prev, page: 1 })); }} className="input w-auto">
              <option value="">All Types</option>
              <option value="UPI">UPI</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Branch</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Services</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No payments found.</p>
                    <p className="text-sm">Payments will appear here once recorded.</p>
                  </td>
                </tr>
              ) : (
                (paginatedPayments || []).map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(payment.created_at)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{payment.branch_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{payment.employee_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate" title={payment.services}>
                    {payment.services && payment.services.length > 0 
                      ? payment.services 
                      : 'No Service'}
                  </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentTypeColor(payment.payment_type)}`}>
                        {payment.payment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{formatCurrency(payment.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => setEditingPayment(payment)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg inline-flex"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteId(payment._id || payment.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg inline-flex"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {payments.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{(pagination.page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-medium">{Math.min(pagination.page * ITEMS_PER_PAGE, payments.length)}</span> of{' '}
              <span className="font-medium">{payments.length}</span> results
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

      {editingPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Payment</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const formData = new FormData(e.target);
                await paymentsAPI.update(editingPayment._id || editingPayment.id, {
                  amount: parseFloat(formData.get('amount')),
                  payment_type: formData.get('payment_type')
                });
                setEditingPayment(null);
                loadData();
              } catch (err) {
                alert(err.response?.data?.message || 'Failed to update payment');
              }
            }} className="space-y-4">
              <div>
                <label htmlFor="editAmount" className="label">Amount</label>
                <input id="editAmount" name="amount" type="number" step="0.01" defaultValue={editingPayment.amount} className="input" required />
              </div>
              <div>
                <label htmlFor="editPaymentType" className="label">Payment Type</label>
                <select id="editPaymentType" name="payment_type" defaultValue={editingPayment.payment_type} className="input">
                  <option value="UPI">UPI</option>
                  <option value="CASH">CASH</option>
                  <option value="CARD">CARD</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingPayment(null)} className="flex-1 btn-secondary">Cancel</button>
                <button type="submit" className="flex-1 btn-primary">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-semibold mb-2">Delete Payment?</h2>
            <p className="text-gray-600 mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
              <button 
                onClick={async () => {
                  try {
                    await paymentsAPI.delete(deleteId);
                    setDeleteId(null);
                    loadData();
                  } catch (err) {
                    alert(err.response?.data?.message || 'Failed to delete payment');
                  }
                }} 
                className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
