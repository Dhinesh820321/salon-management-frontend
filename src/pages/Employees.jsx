import { useState, useEffect, useCallback, useRef } from 'react';
import { employeesAPI, branchesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { getRoleColor, getStatusColor } from '../utils/helpers';
import { Plus, Edit, Trash2, User, Loader2, Building2, ChevronLeft, ChevronRight } from 'lucide-react';

const DEFAULT_EMPLOYEES = [];
const ITEMS_PER_PAGE = 10;
const DEFAULT_BRANCHES = [];
const DEFAULT_FORM_DATA = { name: '', role: 'stylist', phone: '', password: '', branch_id: '', salary: 0, status: 'active' };

export default function Employees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState(DEFAULT_EMPLOYEES);
  const [branches, setBranches] = useState(DEFAULT_BRANCHES);
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });

  const isModalOpen = useRef(false);

  const filteredEmployees = selectedBranch === 'all'
    ? employees
    : employees.filter(emp => {
        const empBranchId = emp.branch_id?._id?.toString() || emp.branch_id?.toString();
        return empBranchId === selectedBranch;
      });

  const paginatedEmployees = filteredEmployees.slice((pagination.page - 1) * ITEMS_PER_PAGE, pagination.page * ITEMS_PER_PAGE);

  useEffect(() => {
    const total = filteredEmployees.length;
    setPagination(prev => ({
      ...prev,
      total,
      totalPages: Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
    }));
  }, [filteredEmployees]);

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

  useEffect(() => {
    isModalOpen.current = showModal;
  }, [showModal]);

  const loadBranches = async () => {
    try {
      const branchRes = await branchesAPI.getAll();
      if (branchRes?.data?.success && Array.isArray(branchRes.data.data)) {
        setBranches(branchRes.data.data);
      }
    } catch (err) {
      console.error('Failed to load branches:', err);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await employeesAPI.getAll();
      if (res?.data?.success && Array.isArray(res.data.data)) {
        const employeesData = res.data.data.map(emp => ({
          ...emp,
          salary: emp.salary ?? 0
        }));
        setEmployees(employeesData);
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
      setError(err.response?.data?.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([loadEmployees(), loadBranches()]);
    };

    loadData();

    if (isModalOpen.current) return;

    const interval = setInterval(() => {
      if (!isModalOpen.current) {
        loadData();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!formData.name || formData.name.trim() === '') {
        setError('Name is required');
        setSubmitting(false);
        return;
      }
      
      if (!formData.phone || formData.phone.trim() === '') {
        setError('Phone number is required');
        setSubmitting(false);
        return;
      }
      
      if (!editingEmployee && (!formData.password || formData.password.length < 6)) {
        setError('Password must be at least 6 characters');
        setSubmitting(false);
        return;
      }

      if (editingEmployee) {
        const { password, ...updateData } = formData;
        const dataToSend = password ? { ...updateData, password } : updateData;
        const empId = editingEmployee._id || editingEmployee.id;
        await employeesAPI.update(empId, dataToSend);
      } else {
        await employeesAPI.create(formData);
      }
      
      await loadEmployees();
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Submit error:', err);
      const errorMsg = err.response?.data?.message || 
                       err.response?.data?.error ||
                       err.message ||
                       'Operation failed. Please try again.';
      setError(errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (emp) => {
    setEditingEmployee(emp);
    const branchId = emp.branch_id?._id || emp.branch_id || '';
    setFormData({
      name: emp.name || '',
      role: emp.role || 'employee',
      phone: emp.phone || '',
      password: '',
      branch_id: branchId,
      salary: emp.salary || 0,
      status: emp.status || 'active'
    });
    setError(null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this employee?')) return;
    
    try {
      await employeesAPI.delete(id);
      await loadEmployees();
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.response?.data?.message || err.message || 'Failed to delete employee');
    }
  };

  const resetForm = () => {
    setEditingEmployee(null);
    setFormData(DEFAULT_FORM_DATA);
    setError(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
        <span className="ml-2 text-gray-600">Loading employees...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-gray-600">Manage your team members</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }} 
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-4 mb-4">
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
          <select
            id="filterBranch"
            name="filterBranch"
            value={selectedBranch}
            onChange={(e) => { setSelectedBranch(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
            className="input pl-10 pr-8 appearance-none bg-white min-w-[180px]"
          >
            <option value="all">All Branches</option>
            {branches.map(branch => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-gray-500 self-center">
          {filteredEmployees.length} employee{filteredEmployees.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Branch</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Phone</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Salary</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                {(user?.role === 'admin' || user?.role === 'manager') && (
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedEmployees.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                    No employees found{selectedBranch !== 'all' ? ' for this branch' : ''}. Click "Add Employee" to create one.
                  </td>
                </tr>
              ) : (
                paginatedEmployees.map((emp) => (
                  <tr key={emp.id || emp._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary-600" />
                        </div>
                        <span className="font-medium text-gray-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleColor(emp.role)}`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{emp.branch_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{emp.phone}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">₹{(emp.salary || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(emp.status)}`}>
                        {emp.status}
                      </span>
                    </td>
                    {(user?.role === 'admin' || user?.role === 'manager') && (
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => handleEdit(emp)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                          <Edit className="w-4 h-4" />
                        </button>
                        {user?.role === 'admin' && (
                          <button onClick={() => handleDelete(emp._id || emp.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredEmployees.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Showing <span className="font-medium">{(pagination.page - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
              <span className="font-medium">{Math.min(pagination.page * ITEMS_PER_PAGE, filteredEmployees.length)}</span> of{' '}
              <span className="font-medium">{filteredEmployees.length}</span> results
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setPagination(prev => ({ ...prev, page: prev.page - 1 })); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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
                    onClick={() => { setPagination(prev => ({ ...prev, page })); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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
                onClick={() => { setPagination(prev => ({ ...prev, page: prev.page + 1 })); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
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
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="empName" className="label">Name *</label>
                <input
                  id="empName"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="input"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="empRole" className="label">Role *</label>
                  <select
                    id="empRole"
                    name="role"
                    value={formData.role}
                    onChange={(e) => setFormData({...formData, role: e.target.value})}
                    className="input"
                    required
                  >
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="stylist">Stylist</option>
                    <option value="helper">Helper</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="empPhone" className="label">Phone *</label>
                  <input
                    id="empPhone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="input"
                    required
                    disabled={!!editingEmployee}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="empPassword" className="label">
                  Password {editingEmployee && '(leave blank to keep current)'}
                </label>
                <input
                  id="empPassword"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="input"
                  {...(!editingEmployee && { required: true, minLength: 6 })}
                  placeholder={editingEmployee ? '••••••••' : 'Min 6 characters'}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="empBranch" className="label">Branch</label>
                  <select
                    id="empBranch"
                    name="branch_id"
                    value={formData.branch_id}
                    onChange={(e) => setFormData({...formData, branch_id: e.target.value})}
                    className="input"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => (
                      <option key={b._id} value={b._id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="empSalary" className="label">Salary</label>
                  <input
                    id="empSalary"
                    name="salary"
                    type="number"
                    value={formData.salary}
                    onChange={(e) => setFormData({...formData, salary: e.target.value})}
                    className="input"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="empStatus" className="label">Status</label>
                <select
                  id="empStatus"
                  name="status"
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className="input"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Saving...
                    </span>
                  ) : (
                    editingEmployee ? 'Update' : 'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
