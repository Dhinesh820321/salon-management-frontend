import axios from 'axios';
import { cleanParams } from '../utils/cleanParams';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

api.interceptors.request.use(
  (config) => {
    console.log(`🔵 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
      data: config.data,
      params: config.params
    });
    if (config.params) {
      config.params = cleanParams(config.params);
    }
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    console.log(`🟢 API Response: ${response.status} ${response.config.url}`, response.data);
    return response;
  },
  (error) => {
    console.error(`🔴 API Error: ${error.config?.url}`, {
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    });
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  // Admin login
  adminLogin: (data) => api.post('/auth/admin/login', data),
  // Employee login (with geofencing)
  employeeLogin: (data) => api.post('/auth/employee/login', data),
  // Legacy login (auto-detects role)
  login: (data) => api.post('/auth/login/password', data),
  // OTP flow
  requestOTP: (data) => api.post('/auth/otp/request', data),
  verifyOTP: (data) => api.post('/auth/otp/verify', data),
  resetPassword: (data) => api.post('/auth/password/reset', data),
  // Profile
  getProfile: () => api.get('/auth/profile'),
  changePassword: (data) => api.post('/auth/password/change', data),
  // Check admin
  checkAdmin: () => api.get('/auth/check-admin')
};

export const branchesAPI = {
  getAll: (params) => api.get('/branches', { params }),
  getById: (id) => api.get(`/branches/${id}`),
  create: (data) => api.post('/branches', data),
  update: (id, data) => api.put(`/branches/${id}`, data),
  delete: (id) => api.delete(`/branches/${id}`)
};

export const employeesAPI = {
  getAll: (params) => api.get('/employees', { params }),
  getById: (id) => api.get(`/employees/${id}`),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  delete: (id) => api.delete(`/employees/${id}`),
  getPerformance: (id, params) => api.get(`/employees/${id}/performance`, { params })
};

export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
  getById: (id) => api.get(`/attendance/${id}`),
  create: (data) => api.post('/attendance', data),
  update: (id, data) => api.put(`/attendance/${id}`, data),
  delete: (id) => api.delete(`/attendance/${id}`),
  getToday: (params) => api.get('/attendance/today', { params }),
  getSummary: (params) => api.get('/attendance/summary', { params }),
  checkIn: (data) => api.post('/attendance/check-in', data),
  checkOut: (data) => api.post('/attendance/check-out', data)
};

export const paymentsAPI = {
  getAll: (params) => api.get('/payments', { params }),
  getById: (id) => api.get(`/payments/${id}`),
  create: (data) => api.post('/payments', data),
  update: (id, data) => api.put(`/payments/${id}`, data),
  delete: (id) => api.delete(`/payments/${id}`),
  getDailyTotals: (params) => api.get('/payments/daily-totals', { params }),
  getAnalytics: (params) => api.get('/payments/analytics', { params })
};

export const invoicesAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  getById: (id) => api.get(`/invoices/${id}`),
  create: (data) => api.post('/invoices', data),
  update: (id, data) => api.put(`/invoices/${id}`, data),
  delete: (id) => api.delete(`/invoices/${id}`),
  getDailyRevenue: (params) => api.get('/invoices/daily-revenue', { params }),
  getMonthlyRevenue: (params) => api.get('/invoices/monthly-revenue', { params })
};

export const servicesAPI = {
  getAll: (params) => api.get('/services', { params }),
  getById: (id) => api.get(`/services/${id}`),
  create: (data) => api.post('/services', data),
  update: (id, data) => api.put(`/services/${id}`, data),
  delete: (id) => api.delete(`/services/${id}`)
};

export const customersAPI = {
  getAll: (params) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  create: (data) => api.post('/customers', data),
  update: (id, data) => api.put(`/customers/${id}`, data),
  delete: (id) => api.delete(`/customers/${id}`),
  getVisitHistory: (id) => api.get(`/customers/${id}/visit-history`),
  getRetentionAlerts: (params) => api.get('/customers/retention-alerts', { params })
};

export const expensesAPI = {
  getAll: (params) => api.get('/expenses', { params }),
  getById: (id) => api.get(`/expenses/${id}`),
  create: (data) => api.post('/expenses', data),
  update: (id, data) => api.put(`/expenses/${id}`, data),
  delete: (id) => api.delete(`/expenses/${id}`),
  getSummary: (params) => api.get('/expenses/summary', { params })
};

export const expenseCategoriesAPI = {
  getAll: (params) => api.get('/expense-categories', { params }),
  getActive: () => api.get('/expense-categories/active'),
  getById: (id) => api.get(`/expense-categories/${id}`),
  create: (data) => api.post('/expense-categories', data),
  update: (id, data) => api.put(`/expense-categories/${id}`, data),
  delete: (id) => api.delete(`/expense-categories/${id}`)
};

export const inventoryAPI = {
  getAll: (params) => api.get('/inventory', { params }),
  getById: (id) => api.get(`/inventory/${id}`),
  create: (data) => api.post('/inventory', data),
  update: (id, data) => api.put(`/inventory/${id}`, data),
  delete: (id) => api.delete(`/inventory/${id}`),
  useInventory: (data) => api.post('/inventory/use', data),
  getLowStock: (params) => api.get('/inventory/low-stock', { params }),
  getUsageReport: (params) => api.get('/inventory/usage-report', { params })
};

export const dashboardAPI = {
  getDashboard: (params) => api.get('/dashboard', { params }),
  getBranchComparison: (params) => api.get('/dashboard/branch-comparison', { params }),
  getRevenueTrend: (params) => api.get('/dashboard/revenue-trend', { params }),
  getRevenueChart: (params) => api.get('/dashboard/revenue-chart', { params }),
  getTopPerformers: (params) => api.get('/dashboard/top-performers', { params })
};

export const reportsAPI = {
  getDailyReport: (params) => api.get('/reports/daily', { params }),
  getMonthlyReport: (params) => api.get('/reports/monthly', { params }),
  getBranchPerformance: (params) => api.get('/reports/branch-performance', { params }),
  getEmployeePerformance: (params) => api.get('/reports/employee-performance', { params })
};

export default api;
