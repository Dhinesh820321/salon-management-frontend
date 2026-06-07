import { useState, useEffect, useRef } from 'react';
import { invoicesAPI, servicesAPI, customersAPI, branchesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { cleanParams } from '../utils/cleanParams';
import { formatCurrency, formatDateTime, getPaymentTypeColor, exportToPDF } from '../utils/helpers';
import { Plus, Receipt, Search, Calendar, ChevronLeft, ChevronRight, Edit, Trash2, FileDown, Loader2 } from 'lucide-react';

const DEFAULT_INVOICES = [];
const DEFAULT_SERVICES = [];
const DEFAULT_CUSTOMERS = [];
const DEFAULT_BRANCHES = [];
const DEFAULT_FORM_DATA = { branch_id: '', customer_id: '', employee_id: '', items: [], payment_type: 'CASH', notes: '' };
const ITEMS_PER_PAGE = 10;

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState(DEFAULT_INVOICES);
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [customers, setCustomers] = useState(DEFAULT_CUSTOMERS);
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filters, setFilters] = useState({ date: '', branch_id: '' });
  const [formData, setFormData] = useState({ ...DEFAULT_FORM_DATA, branch_id: user?.branch_id || '', employee_id: user?.id });
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [exporting, setExporting] = useState(false);
  const isModalOpen = useRef(false);

  useEffect(() => { loadData(); }, [filters]);

  useEffect(() => {
    isModalOpen.current = showModal;
  }, [showModal]);

  const loadData = async () => {
    try {
      const params = cleanParams({ ...filters });
      const [invRes, svcRes, custRes, branchRes] = await Promise.all([
        invoicesAPI.getAll(params),
        servicesAPI.getAll({ status: 'active' }),
        customersAPI.getAll(),
        branchesAPI.getAll()
      ]);
      if (invRes?.data?.success && Array.isArray(invRes.data.data)) {
        setInvoices(invRes.data.data);
        const total = invRes.data.data.length;
        setPagination(prev => ({
          ...prev,
          total,
          totalPages: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
        }));
      }
      if (svcRes?.data?.success && Array.isArray(svcRes.data.data)) {
        setServices(svcRes.data.data);
      }
      if (custRes?.data?.success && Array.isArray(custRes.data.data)) {
        setCustomers(custRes.data.data);
      }
      if (branchRes?.data?.success && Array.isArray(branchRes.data.data)) {
        setBranches(branchRes.data.data);
      }
    } catch (error) { console.error('Error:', error); }
    setLoading(false);
  };

  const handleAddItem = (service) => {
    const item = {
      service_id: service.id,
      service_name: service.name,
      price: service.price,
      gst_percentage: service.gst_percentage,
      quantity: 1,
      subtotal: service.price
    };
    setFormData({ ...formData, items: [...formData.items, item] });
  };

  const handleRemoveItem = (index) => {
    const items = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items });
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

  const paginatedInvoices = invoices.slice((pagination.page - 1) * ITEMS_PER_PAGE, pagination.page * ITEMS_PER_PAGE);

  const handleExportPDF = () => {
    setExporting(true);
    try {
      const columns = [
        { key: 'invoice_number', header: 'Invoice #' },
        { key: 'customer_name', header: 'Customer' },
        { key: 'branch_name', header: 'Branch' },
        { key: 'employee_name', header: 'Employee' },
        { key: 'final_amount', header: 'Amount', format: (val) => formatCurrency(val) },
        { key: 'payment_type', header: 'Payment' },
        { key: 'created_at', header: 'Date', format: (val) => formatDateTime(val) },
      ];
      
      const totalAmount = invoices.reduce((sum, inv) => sum + (inv.final_amount || 0), 0);
      
      exportToPDF({
        title: 'Invoices Report',
        data: invoices,
        columns,
        filename: 'invoices',
        footerData: {
          totalCount: invoices.length,
          totalAmount
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
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600">Create and manage invoices</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExportPDF} 
            disabled={exporting || invoices.length === 0}
            className="btn-secondary flex items-center gap-2"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} 
            Export PDF
          </button>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <label htmlFor="invoiceDate" className="sr-only">Filter by Date</label>
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input id="invoiceDate" name="date" type="date" value={filters.date} onChange={(e) => { setFilters({...filters, date: e.target.value}); setPagination(prev => ({ ...prev, page: 1 })); }} className="input pl-10" />
          </div>
          {user?.role === 'admin' && (
            <div className="flex flex-col gap-1">
              <label htmlFor="invoiceBranchFilter" className="sr-only">Filter by Branch</label>
              <select id="invoiceBranchFilter" name="branch_id" value={filters.branch_id} onChange={(e) => { setFilters({...filters, branch_id: e.target.value}); setPagination(prev => ({ ...prev, page: 1 })); }} className="input w-auto">
                <option value="">All Branches</option>
                {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
<thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Invoice #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Branch</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Services</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Amount</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Payment</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                    <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No invoices found.</p>
                    <p className="text-sm">Create a new invoice to get started.</p>
                  </td>
                </tr>
              ) : (
                (paginatedInvoices || []).map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-primary-600">{inv.invoice_number}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{inv.customer_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inv.branch_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate" title={inv.services}>
                      {inv.services || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{inv.employee_name}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{formatCurrency(inv.final_amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPaymentTypeColor(inv.payment_type)}`}>
                        {inv.payment_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(inv.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => {
                          setEditingInvoice(inv);
                          setFormData({
                            branch_id: inv.branch_id || '',
                            customer_id: inv.customer_id || '',
                            employee_id: user?.id,
                            items: inv.items || [],
                            payment_type: inv.payment_type || 'CASH',
                            notes: inv.notes || ''
                          });
                          setShowModal(true);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg inline-flex"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteId(inv._id || inv.id)}
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

        {invoices.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{(pagination.page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-medium">{Math.min(pagination.page * ITEMS_PER_PAGE, invoices.length)}</span> of{' '}
              <span className="font-medium">{invoices.length}</span> results
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

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">{editingInvoice ? 'Edit Invoice' : 'New Invoice'}</h2>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                const totalAmount = formData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const taxAmount = formData.items.reduce((sum, item) => sum + ((item.price * item.quantity * item.gst_percentage) / 100), 0);
                const finalAmount = totalAmount + taxAmount;
                
                if (editingInvoice) {
                  await invoicesAPI.update(editingInvoice._id || editingInvoice.id, {
                    ...formData,
                    total_amount: totalAmount,
                    tax_amount: taxAmount,
                    final_amount: finalAmount
                  });
                } else {
                  await invoicesAPI.create({
                    ...formData,
                    total_amount: totalAmount,
                    tax_amount: taxAmount,
                    final_amount: finalAmount
                  });
                }
                loadData();
                setShowModal(false);
                setEditingInvoice(null);
                setFormData({ branch_id: user?.branch_id || '', customer_id: '', employee_id: user?.id, items: [], payment_type: 'CASH', notes: '' });
              } catch (error) {
                alert(error.response?.data?.message || 'Failed to save invoice');
              }
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="invBranchId" className="label">Branch</label>
                  <select id="invBranchId" name="branch_id" value={formData.branch_id} onChange={(e) => setFormData({...formData, branch_id: e.target.value})} className="input" required>
                    <option value="">Select Branch</option>
                    {(branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="invCustomer" className="label">Customer</label>
                  <select id="invCustomer" name="customer_id" value={formData.customer_id} onChange={(e) => setFormData({...formData, customer_id: e.target.value})} className="input">
                    <option value="">Walk-in Customer</option>
                    {(customers || []).map(c => <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Services</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {(services || []).map(s => (
                    <button type="button" key={s.id} onClick={() => handleAddItem(s)} className="p-2 text-left border rounded-lg hover:bg-gray-50 text-sm">
                      {s.name} - {formatCurrency(s.price)}
                    </button>
                  ))}
                </div>
                {formData.items.length > 0 && (
                  <div className="border rounded-lg p-3 space-y-2">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                        <span>{item.service_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{formatCurrency(item.price * item.quantity)}</span>
                          <button type="button" onClick={() => handleRemoveItem(idx)} className="text-red-600 hover:bg-red-50 px-2 py-1 rounded">×</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="invPaymentType" className="label">Payment Type</label>
                  <select id="invPaymentType" name="payment_type" value={formData.payment_type} onChange={(e) => setFormData({...formData, payment_type: e.target.value})} className="input">
                    <option value="CASH">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="CARD">Card</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="invNotes" className="label">Notes</label>
                <textarea id="invNotes" name="notes" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} className="input" rows="2"></textarea>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowModal(false); setEditingInvoice(null); setFormData({ branch_id: user?.branch_id || '', customer_id: '', employee_id: user?.id, items: [], payment_type: 'CASH', notes: '' }); }} className="flex-1 btn-secondary">Cancel</button>
                <button type="submit" className="flex-1 btn-primary">{editingInvoice ? 'Update Invoice' : 'Create Invoice'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h2 className="text-xl font-semibold mb-2">Delete Invoice?</h2>
            <p className="text-gray-600 mb-4">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 btn-secondary">Cancel</button>
              <button 
                onClick={async () => {
                  try {
                    await invoicesAPI.delete(deleteId);
                    setDeleteId(null);
                    loadData();
                  } catch (err) {
                    alert(err.response?.data?.message || 'Failed to delete invoice');
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
