import { useState, useEffect, useCallback, useRef } from 'react';
import { expensesAPI, branchesAPI, employeesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, formatDate, exportToPDF } from '../utils/helpers';
import { Loader2, FileText, ChevronLeft, ChevronRight, Edit, Trash2, FileDown, X, ChevronDown, ChevronUp, Search } from 'lucide-react';

const DEFAULT_EXPENSES = [];
const DEFAULT_BRANCHES = [];
const ITEMS_PER_PAGE = 10;

export default function Expenses() {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState(DEFAULT_EXPENSES);
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ date: '', branch_id: '', payment_mode: '', employee_id: '' });
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [summary, setSummary] = useState({ cashExpenses: { total: 0, count: 0 }, onlineExpenses: { total: 0, count: 0 }, total: 0 });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [error, setError] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [expandedItems, setExpandedItems] = useState(null);
  const [viewDetailsModal, setViewDetailsModal] = useState(null);
  const isModalOpen = useRef(false);

  const loadBranches = useCallback(async () => {
    try {
      const branchRes = await branchesAPI.getAll();
      if (branchRes?.data?.success && Array.isArray(branchRes.data.data)) {
        setBranches(branchRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  }, []);

  const loadEmployees = useCallback(async () => {
    try {
      const empRes = await employeesAPI.getAll();
      if (empRes?.data?.success && Array.isArray(empRes.data.data)) {
        setEmployees(empRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }, []);

  const loadExpenses = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const params = { ...filters };
      Object.keys(params).forEach(key => !params[key] && delete params[key]);
      
      const [expRes, summaryRes] = await Promise.all([
        expensesAPI.getAll(params),
        expensesAPI.getSummary({ branch_id: filters.branch_id, start_date: filters.date, end_date: filters.date })
      ]);
      
      if (expRes?.data?.success && Array.isArray(expRes.data.data)) {
        setExpenses(expRes.data.data);
        const total = expRes.data.data.length;
        setPagination(prev => ({
          ...prev,
          page,
          total,
          totalPages: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
        }));
      }
      if (summaryRes?.data?.success) {
        setSummary(summaryRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
      setError(err.response?.data?.message || 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([loadBranches(), loadEmployees()]);
      loadExpenses(1);
    };
    loadData();
  }, [loadBranches, loadEmployees]);

  useEffect(() => {
    isModalOpen.current = false;
  }, []);

  useEffect(() => {
    if (!isModalOpen.current) {
      const timer = setTimeout(() => loadExpenses(1), 100);
      return () => clearTimeout(timer);
    }
  }, [filters, loadExpenses]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
      loadExpenses(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const paginatedExpenses = expenses.slice((pagination.page - 1) * ITEMS_PER_PAGE, pagination.page * ITEMS_PER_PAGE);

const handleExportPDF = () => {
    setExporting(true);
    try {
      const cashExpenses = expenses.filter(e => e.payment_mode === 'CASH');
      const upiExpenses = expenses.filter(e => e.payment_mode === 'UPI');
      
      const totalCash = cashExpenses.reduce((sum, e) => sum + (Number(e.grand_total) || Number(e.amount) || 0), 0);
      const totalUPI = upiExpenses.reduce((sum, e) => sum + (Number(e.grand_total) || Number(e.amount) || 0), 0);
      const grandTotal = totalCash + totalUPI;
      
      const formatForPDF = (expenseArray) => expenseArray.map(e => [
        formatDate(e.created_at),
        e.title || '-',
        e.employee_name || '-',
        (Number(e.grand_total) || Number(e.amount) || 0).toFixed(2)
      ]);
      
      exportToPDF({
        title: 'Expenses Report',
        data: expenses,
        filename: 'expenses',
        reportType: 'expenses_summary',
        sections: {
          cash: {
            title: 'Cash Expenses',
            data: formatForPDF(cashExpenses),
            total: totalCash
          },
          upi: {
            title: 'UPI Expenses',
            data: formatForPDF(upiExpenses),
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

  if (loading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading expenses...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Expenses</h1>
          <p className="text-gray-600">View employee-recorded expenses</p>
        </div>
        <button 
          onClick={handleExportPDF} 
          disabled={exporting || expenses.length === 0}
          className="btn-secondary flex items-center gap-2"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
          Export PDF
        </button>
      </div>

      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 bg-green-50 border-green-100">
          <p className="text-sm text-green-600 font-medium">Cash Expenses</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(summary.cashExpenses?.total || 0)}</p>
          <p className="text-xs text-green-500">{summary.cashExpenses?.count || 0} transactions</p>
        </div>
        <div className="card p-4 bg-blue-50 border-blue-100">
          <p className="text-sm text-blue-600 font-medium">Online Expenses</p>
          <p className="text-2xl font-bold text-blue-700">{formatCurrency(summary.onlineExpenses?.total || 0)}</p>
          <p className="text-xs text-blue-500">{summary.onlineExpenses?.count || 0} transactions</p>
        </div>
        <div className="card p-4 bg-gray-50 border-gray-100">
          <p className="text-sm text-gray-600 font-medium">Total Expenses</p>
          <p className="text-2xl font-bold text-gray-700">{formatCurrency(summary.total || 0)}</p>
          <p className="text-xs text-gray-500">{(summary.cashExpenses?.count || 0) + (summary.onlineExpenses?.count || 0)} transactions</p>
        </div>
      </div> */}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="filterDate" className="text-xs font-medium text-gray-500">Date</label>
            <input
              id="filterDate"
              name="date"
              type="date"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
              className="input w-auto"
            />
          </div>
          {user?.role === 'admin' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="filterBranch" className="text-xs font-medium text-gray-500">Branch</label>
              <select
                id="filterBranch"
                name="branch_id"
                value={filters.branch_id}
                onChange={(e) => handleFilterChange('branch_id', e.target.value)}
                className="input w-auto"
              >
                <option value="">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
          {user?.role === 'admin' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="filterEmployee" className="text-xs font-medium text-gray-500">Employee</label>
              <select
                id="filterEmployee"
                name="employee_id"
                value={filters.employee_id}
                onChange={(e) => handleFilterChange('employee_id', e.target.value)}
                className="input w-auto"
              >
                <option value="">All Employees</option>
                {employees.filter(e => e.role !== 'admin').map(emp => (
                  <option key={emp.id || emp._id} value={emp.id || emp._id}>{emp.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label htmlFor="filterPayment" className="text-xs font-medium text-gray-500">Payment Mode</label>
            <select
              id="filterPayment"
              name="payment_mode"
              value={filters.payment_mode}
              onChange={(e) => handleFilterChange('payment_mode', e.target.value)}
              className="input w-auto"
            >
              <option value="">All</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 self-end">
            <button
              onClick={() => setFilters({ date: '', branch_id: '', payment_mode: '', employee_id: '' })}
              className="btn-secondary text-sm py-2"
            >
              Clear Filters
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Branch</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Title</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Items</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Payment</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-12 h-12 text-gray-300" />
                      <p>No expenses found.</p>
                      <p className="text-sm">Expenses recorded by employees will appear here.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((expense) => (
                  <tr key={expense.id || expense._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDate(expense.created_at)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{expense.employee_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{expense.branch_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{expense.title}</td>
                    <td className="px-4 py-3 align-top text-xs text-gray-600 max-w-[280px]">
                      {expense.items?.length > 0 ? (
                        <div className="space-y-1">
                          {expense.items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="flex justify-between gap-2">
                              <span className="truncate">{idx + 1}. {item.itemName}</span>
                              <span className="font-medium text-gray-700 whitespace-nowrap">₹{item.price} x {item.quantity}</span>
                            </div>
                          ))}
                          {expense.items.length > 2 && (
                            <button
                              onClick={() => setViewDetailsModal(expense)}
                              className="text-xs text-blue-600 font-medium mt-1 hover:underline"
                            >
                              View {expense.items.length} items
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        expense.payment_mode === 'CASH' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {expense.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">
                      {formatCurrency(expense.grand_total || expense.amount || 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => setEditingExpense(expense)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg inline-flex"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteId(expense._id || expense.id)}
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

        {expenses.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{(pagination.page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-medium">{Math.min(pagination.page * ITEMS_PER_PAGE, expenses.length)}</span> of{' '}
              <span className="font-medium">{expenses.length}</span> results
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

      {editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Edit Expense</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const formData = new FormData(e.target);
                await expensesAPI.update(editingExpense._id || editingExpense.id, {
                  title: formData.get('title'),
                  amount: parseFloat(formData.get('amount')),
                  payment_mode: formData.get('payment_mode'),
                  notes: formData.get('notes') || ''
                });
                setEditingExpense(null);
                loadExpenses(pagination.page);
              } catch (err) {
                alert(err.response?.data?.message || 'Failed to update expense');
              }
            }} className="space-y-4">
              <div>
                <label htmlFor="editTitle" className="label">Title</label>
                <input id="editTitle" name="title" type="text" defaultValue={editingExpense.title} className="input" required />
              </div>
              <div>
                <label htmlFor="editAmount" className="label">Amount</label>
                <input id="editAmount" name="amount" type="number" step="0.01" defaultValue={editingExpense.amount} className="input" required />
              </div>
              <div>
                <label htmlFor="editPayment" className="label">Payment Mode</label>
                <select id="editPayment" name="payment_mode" defaultValue={editingExpense.payment_mode} className="input">
                  <option value="CASH">CASH</option>
                  <option value="ONLINE">ONLINE</option>
                </select>
              </div>
              <div>
                <label htmlFor="editNotes" className="label">Notes</label>
                <textarea id="editNotes" name="notes" defaultValue={editingExpense.notes} className="input" rows="3" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingExpense(null)} className="flex-1 btn-secondary">Cancel</button>
                <button type="submit" className="flex-1 btn-primary">Update</button>
              </div>
            </form>
          </div>
        </div>
      )}

{deleteId && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
              <h2 className="text-xl font-semibold mb-2">Delete Expense?</h2>
              <p className="text-gray-600 mb-4">This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
                <button 
                  onClick={async () => {
                    try {
                      await expensesAPI.delete(deleteId);
                      setDeleteId(null);
                      loadExpenses(pagination.page);
                    } catch (err) {
                      alert(err.response?.data?.message || 'Failed to delete expense');
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

        {viewDetailsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Expense Items</h2>
                <button onClick={() => setViewDetailsModal(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Date:</span> {formatDate(viewDetailsModal.created_at)}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Employee:</span> {viewDetailsModal.employee_name}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Branch:</span> {viewDetailsModal.branch_name}
                </p>
              </div>
              <div className="border-t border-gray-200 pt-4">
                <h3 className="font-medium mb-3">Items List</h3>
                <div className="space-y-2">
                  {viewDetailsModal.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                      <span className="text-sm">{idx + 1}. {item.itemName}</span>
                      <span className="text-sm font-medium">₹{item.price} x {item.quantity} = ₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">{formatCurrency(viewDetailsModal.grand_total || viewDetailsModal.amount || 0)}</span>
                </div>
              </div>
              <button onClick={() => setViewDetailsModal(null)} className="btn-primary w-full mt-4">Close</button>
            </div>
          </div>
        )}
    </div>
  );
}
