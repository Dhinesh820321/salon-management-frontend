import { useState, useEffect, useCallback } from 'react';
import { servicesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/helpers';
import { Plus, Edit, Trash2, Scissors, Loader2 } from 'lucide-react';

const DEFAULT_SERVICES = [];
const DEFAULT_FORM_DATA = { name: '', price: '', gst_percentage: 18, duration_minutes: 30, commission_percentage: 0, status: 'active' };

export default function Services() {
  const { user } = useAuth();
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM_DATA);
  const [error, setError] = useState(null);

  const loadServices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await servicesAPI.getAll();
      if (res?.data?.success && Array.isArray(res.data.data)) {
        setServices(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load services:', err);
      setError(err.response?.data?.message || 'Failed to load services');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (editingService) {
        await servicesAPI.update(editingService.id, formData);
      } else {
        await servicesAPI.create(formData);
      }
      
      await loadServices();
      setShowModal(false);
      resetForm();
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.response?.data?.message || 'Operation failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      price: service.price,
      gst_percentage: service.gst_percentage,
      duration_minutes: service.duration_minutes,
      commission_percentage: service.commission_percentage || 0,
      status: service.status
    });
    setError(null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this service?')) return;
    
    try {
      await servicesAPI.delete(id);
      await loadServices();
    } catch (err) {
      console.error('Delete error:', err);
      alert(err.response?.data?.message || 'Failed to delete service');
    }
  };

  const resetForm = () => {
    setEditingService(null);
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
        <span className="ml-2 text-gray-600">Loading services...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-600">Manage your salon services</p>
        </div>
        {(user?.role === 'admin' || user?.role === 'manager') && (
          <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Service
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.length === 0 ? (
          <div className="col-span-full text-center py-12 text-gray-500">
            No services found. Click "Add Service" to create one.
          </div>
        ) : (
          services.map((service) => (
            <div key={service.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 bg-primary-100 rounded-lg">
                  <Scissors className="w-5 h-5 text-primary-600" />
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${service.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {service.status}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
              <p className="text-2xl font-bold text-primary-600 mt-2">{formatCurrency(service.price)}</p>
              <div className="flex items-center justify-between mt-3 pt-3 border-t text-sm text-gray-500">
                <span>{service.duration_minutes} min</span>
                <span>GST: {service.gst_percentage}%</span>
              </div>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <div className="flex gap-2 mt-4">
                  <button onClick={() => handleEdit(service)} className="flex-1 btn-secondary text-sm py-2">
                    <Edit className="w-4 h-4 inline mr-1" /> Edit
                  </button>
                  <button onClick={() => handleDelete(service.id)} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {editingService ? 'Edit Service' : 'Add New Service'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="serviceName" className="label">Service Name *</label>
                <input
                  id="serviceName"
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
                  <label htmlFor="servicePrice" className="label">Price (₹) *</label>
                  <input
                    id="servicePrice"
                    name="price"
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: e.target.value})}
                    className="input"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label htmlFor="serviceDuration" className="label">Duration (min)</label>
                  <input
                    id="serviceDuration"
                    name="duration_minutes"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({...formData, duration_minutes: e.target.value})}
                    className="input"
                    min="1"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="serviceGst" className="label">GST %</label>
                  <input
                    id="serviceGst"
                    name="gst_percentage"
                    type="number"
                    value={formData.gst_percentage}
                    onChange={(e) => setFormData({...formData, gst_percentage: e.target.value})}
                    className="input"
                    min="0"
                    max="100"
                  />
                </div>
                <div>
                  <label htmlFor="serviceCommission" className="label">Commission %</label>
                  <input
                    id="serviceCommission"
                    name="commission_percentage"
                    type="number"
                    value={formData.commission_percentage}
                    onChange={(e) => setFormData({...formData, commission_percentage: e.target.value})}
                    className="input"
                    min="0"
                    max="100"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="serviceStatus" className="label">Status</label>
                <select
                  id="serviceStatus"
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
                    editingService ? 'Update' : 'Create'
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
