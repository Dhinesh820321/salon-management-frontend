import { useState, useEffect, useRef, useMemo } from 'react';
import { attendanceAPI, branchesAPI, employeesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatTime, formatCurrency, exportToPDF } from '../utils/helpers';
import { Clock, LogIn, LogOut, Calendar, Loader2, User, Building2, Users, FileDown, ChevronLeft, ChevronRight } from 'lucide-react';

const getDaysInMonth = (year, month) => new Date(year, month, 0).getDate();
const ITEMS_PER_PAGE = 10;

const formatHours = (decimalHours) => {
  if (!decimalHours || decimalHours === 0) return '0h';
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

export default function Attendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  
  const [attendance, setAttendance] = useState([]);
  const [branches, setBranches] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterType, setFilterType] = useState('date');
  
  const [viewMode, setViewMode] = useState('summary');
  
  const [stats, setStats] = useState({ totalPresent: 0, totalAbsent: 0, totalHours: 0 });
  const [pagination, setPagination] = useState({ summaryPage: 1, detailsPage: 1, total: 0 });
  const [exporting, setExporting] = useState(false);

  const selectedBranchRef = useRef(selectedBranch);

  useEffect(() => {
    selectedBranchRef.current = selectedBranch;
  }, [selectedBranch]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        const res = await branchesAPI.getAll();
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setBranches(res.data.data);
        }
      } catch (error) {
        console.error('Failed to load branches:', error);
      }
    };

    const loadEmployees = async () => {
      try {
        const res = await employeesAPI.getAll();
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setEmployees(res.data.data);
        }
      } catch (error) {
        console.error('Failed to load employees:', error);
      }
    };

    const loadAttendance = async () => {
      try {
        setLoading(true);
        const params = {};
        
        if (selectedBranchRef.current) params.branch_id = selectedBranchRef.current;
        
        const res = await attendanceAPI.getAll(params);
        if (res?.data?.success && Array.isArray(res.data.data)) {
          setAttendance(res.data.data);
        }
      } catch (error) {
        console.error('Failed to load attendance:', error);
      } finally {
        setLoading(false);
      }
    };

    const loadAll = async () => {
      await Promise.all([loadBranches(), loadEmployees(), loadAttendance()]);
    };

    loadAll();

    const interval = setInterval(loadAttendance, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredAttendance = useMemo(() => {
    return attendance.filter(record => {
      const recordDate = record.date || '';
      const recordMonth = recordDate.substring(0, 7);
      
      let matchesDate = true;
      if (filterType === 'date') {
        matchesDate = recordDate === selectedDate;
      } else if (filterType === 'month') {
        matchesDate = recordMonth === selectedMonth;
      }
      
      const matchesEmployee = !selectedEmployee || 
        record.employee_id?.toString() === selectedEmployee ||
        record.employee_id?._id?.toString() === selectedEmployee;
      
      return matchesDate && matchesEmployee;
    });
  }, [attendance, selectedDate, selectedMonth, filterType, selectedEmployee]);

  const summaryData = useMemo(() => {
    const grouped = {};
    
    filteredAttendance.forEach(record => {
      const empId = record.employee_id?._id?.toString() || record.employee_id?.toString();
      const empName = record.employee_name || 'Unknown';
      const branchName = record.branch_name || '-';
      const role = record.employee_role || 'employee';
      
      if (!grouped[empId]) {
        grouped[empId] = {
          employee_id: empId,
          employee_name: empName,
          branch_name: branchName,
          role: role,
          present_days: 0,
          total_hours: 0,
          records: []
        };
      }
      
      grouped[empId].present_days += 1;
      grouped[empId].total_hours += record.total_hours || 0;
      grouped[empId].records.push(record);
    });
    
    const [year, month] = selectedMonth.split('-').map(Number);
    const totalDaysInMonth = getDaysInMonth(year, month);
    
    Object.values(grouped).forEach(emp => {
      emp.absent_days = Math.max(0, totalDaysInMonth - emp.present_days);
      emp.total_days = totalDaysInMonth;
    });
    
    return Object.values(grouped).sort((a, b) => b.present_days - a.present_days);
  }, [filteredAttendance, selectedMonth]);

  useEffect(() => {
    const totalPresent = summaryData.reduce((sum, emp) => sum + emp.present_days, 0);
    const totalAbsent = summaryData.reduce((sum, emp) => sum + emp.absent_days, 0);
    const totalHours = summaryData.reduce((sum, emp) => sum + emp.total_hours, 0);
    setStats({ totalPresent, totalAbsent, totalHours });
  }, [summaryData]);

  const paginatedSummary = summaryData.slice((pagination.summaryPage - 1) * ITEMS_PER_PAGE, pagination.summaryPage * ITEMS_PER_PAGE);
  const paginatedDetails = filteredAttendance.slice((pagination.detailsPage - 1) * ITEMS_PER_PAGE, pagination.detailsPage * ITEMS_PER_PAGE);

  useEffect(() => {
    const summaryTotal = Math.ceil(summaryData.length / ITEMS_PER_PAGE);
    const detailsTotal = Math.ceil(filteredAttendance.length / ITEMS_PER_PAGE);
    setPagination(prev => ({
      ...prev,
      summaryTotal,
      detailsTotal
    }));
  }, [summaryData, filteredAttendance]);

  const handlePageChange = (type, newPage) => {
    const totalPages = type === 'summary' ? Math.ceil(summaryData.length / ITEMS_PER_PAGE) : Math.ceil(filteredAttendance.length / ITEMS_PER_PAGE);
    if (newPage >= 1 && newPage <= totalPages) {
      setPagination(prev => ({ ...prev, [`${type}Page`]: newPage }));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = (type) => {
    const pages = [];
    const total = type === 'summary' ? Math.ceil(summaryData.length / ITEMS_PER_PAGE) : Math.ceil(filteredAttendance.length / ITEMS_PER_PAGE);
    const current = type === 'summary' ? pagination.summaryPage : pagination.detailsPage;
    
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

  const handleExportPDF = () => {
    if (summaryData.length === 0) return;
    setExporting(true);
    try {
      const columns = [
        { key: 'employee_name', header: 'Employee Name' },
        { key: 'branch_name', header: 'Branch' },
        { key: 'role', header: 'Role' },
        { key: 'present_days', header: 'Present Days' },
        { key: 'absent_days', header: 'Absent Days' },
        { key: 'total_hours', header: 'Total Hours', format: (val) => formatHours(val) },
      ];
      
      exportToPDF({
        title: `Attendance Report - ${filterType === 'date' ? selectedDate : selectedMonth}`,
        data: summaryData,
        columns,
        filename: `attendance-report`,
        footerData: {
          totalCount: summaryData.length
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
        <span className="ml-2 text-gray-600">Loading attendance...</span>
      </div>
    );
  }

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthName = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const totalDaysInMonth = getDaysInMonth(year, month);
  const dateLabel = filterType === 'date' 
    ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : `${monthName} (${totalDaysInMonth} days)`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
          <p className="text-gray-600">Track and manage employee attendance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('summary')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'summary' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Users className="w-4 h-4 inline mr-1" /> Summary
          </button>
          <button
            onClick={() => setViewMode('details')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'details' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Clock className="w-4 h-4 inline mr-1" /> Details
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                onClick={() => setFilterType('date')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  filterType === 'date' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Date
              </button>
              <button
                onClick={() => setFilterType('month')}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  filterType === 'month' ? 'bg-primary-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Month
              </button>
            </div>
            
            {filterType === 'date' ? (
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <input
                  id="selectedDate"
                  name="selectedDate"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="input py-2"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <input
                  id="selectedMonth"
                  name="selectedMonth"
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input py-2"
                />
              </div>
            )}
          </div>
          
          {isAdmin && (
            <>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <select
                  id="selectedBranch"
                  name="selectedBranch"
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="input pl-10 pr-8 appearance-none bg-white min-w-[160px]"
                >
                  <option value="">All Branches</option>
                  {branches.map(branch => (
                    <option key={branch.id || branch._id} value={branch.id || branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                <select
                  id="selectedEmployee"
                  name="selectedEmployee"
                  value={selectedEmployee}
                  onChange={(e) => setSelectedEmployee(e.target.value)}
                  className="input pl-10 pr-8 appearance-none bg-white min-w-[160px]"
                >
                  <option value="">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id || emp._id} value={emp.id || emp._id}>
                      {emp.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card text-center bg-gradient-to-br from-primary-50 to-primary-100">
            <div className="w-12 h-12 mx-auto bg-primary-600 rounded-full flex items-center justify-center mb-3">
              <Users className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900">{summaryData.length}</h3>
            <p className="text-gray-600 text-sm">Active Employees</p>
          </div>
          <div className="card text-center bg-gradient-to-br from-blue-50 to-blue-100">
            <div className="w-12 h-12 mx-auto bg-blue-600 rounded-full flex items-center justify-center mb-3">
              <Calendar className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-blue-600">{totalDaysInMonth}</h3>
            <p className="text-gray-600 text-sm">Total Days</p>
          </div>
          <div className="card text-center bg-gradient-to-br from-green-50 to-green-100">
            <div className="w-12 h-12 mx-auto bg-green-600 rounded-full flex items-center justify-center mb-3">
              <LogIn className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-green-600">{stats.totalPresent}</h3>
            <p className="text-gray-600 text-sm">Present Days</p>
          </div>
          <div className="card text-center bg-gradient-to-br from-red-50 to-red-100">
            <div className="w-12 h-12 mx-auto bg-red-600 rounded-full flex items-center justify-center mb-3">
              <LogOut className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-red-600">{stats.totalAbsent}</h3>
            <p className="text-gray-600 text-sm">Absent Days</p>
          </div>
          <div className="card text-center bg-gradient-to-br from-yellow-50 to-yellow-100">
            <div className="w-12 h-12 mx-auto bg-yellow-600 rounded-full flex items-center justify-center mb-3">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-yellow-600">{formatHours(stats.totalHours)}</h3>
            <p className="text-gray-600 text-sm">Total Hours</p>
          </div>
        </div>
      </div>

      {viewMode === 'summary' ? (
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{filterType === 'date' ? 'Daily' : 'Monthly'} Summary - {dateLabel}</h2>
              {filterType === 'month' && (
                <p className="text-sm text-gray-500">7 days working (No holidays, No weekends)</p>
              )}
            </div>
            <button
              onClick={handleExportPDF}
              disabled={exporting || summaryData.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Export PDF
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Branch</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Present Days</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Absent Days</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedSummary.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-gray-500">
                      No attendance records found for {dateLabel}
                    </td>
                  </tr>
                ) : (
                  paginatedSummary.map((emp) => (
                    <tr key={emp.employee_id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-600 font-semibold">
                              {emp.employee_name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{emp.employee_name}</p>
                            <p className="text-xs text-gray-500 capitalize">{emp.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{emp.branch_name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                          {emp.present_days}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-red-100 text-red-800">
                          {emp.absent_days}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                          {formatHours(emp.total_hours)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {summaryData.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{(pagination.summaryPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="font-medium">{Math.min(pagination.summaryPage * ITEMS_PER_PAGE, summaryData.length)}</span> of{' '}
                <span className="font-medium">{summaryData.length}</span> results
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange('summary', pagination.summaryPage - 1)}
                  disabled={pagination.summaryPage === 1}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                {getPageNumbers('summary').map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange('summary', page)}
                      className={`min-w-[36px] h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        pagination.summaryPage === page
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
                
                <button
                  onClick={() => handlePageChange('summary', pagination.summaryPage + 1)}
                  disabled={pagination.summaryPage === Math.ceil(summaryData.length / ITEMS_PER_PAGE)}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{filterType === 'date' ? 'Date' : 'Monthly'} Details - {dateLabel}</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Employee</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Branch</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Start Time</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">End Time</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Total Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedDetails.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      No attendance records found for {dateLabel}
                    </td>
                  </tr>
                ) : (
                  paginatedDetails.map((record) => (
                    <tr key={record.id || record._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-600 font-semibold text-sm">
                              {record.employee_name?.charAt(0) || '?'}
                            </span>
                          </div>
                          <span className="font-medium text-gray-900">{record.employee_name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.branch_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{record.date || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {record.start_time ? formatTime(record.start_time) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {record.end_time ? formatTime(record.end_time) : '-'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {record.total_hours ? (
                          <span className="text-sm font-medium text-gray-900">{formatHours(record.total_hours)}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredAttendance.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Showing <span className="font-medium">{(pagination.detailsPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                <span className="font-medium">{Math.min(pagination.detailsPage * ITEMS_PER_PAGE, filteredAttendance.length)}</span> of{' '}
                <span className="font-medium">{filteredAttendance.length}</span> results
              </div>
              
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange('details', pagination.detailsPage - 1)}
                  disabled={pagination.detailsPage === 1}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                
                {getPageNumbers('details').map((page, idx) => (
                  page === '...' ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">...</span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange('details', page)}
                      className={`min-w-[36px] h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                        pagination.detailsPage === page
                          ? 'bg-primary-600 text-white'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
                
                <button
                  onClick={() => handlePageChange('details', pagination.detailsPage + 1)}
                  disabled={pagination.detailsPage === Math.ceil(filteredAttendance.length / ITEMS_PER_PAGE)}
                  className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
