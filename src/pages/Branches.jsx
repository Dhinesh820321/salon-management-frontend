import { useState, useEffect } from 'react';
import { branchesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Building2, Plus, Edit, Trash2, MapPin } from 'lucide-react';

const defaultBranches = [
  { id: 1, name: 'Main Branch - Downtown', location: '123 Main Street, Downtown', status: 'active', geo_latitude: 28.6139, geo_longitude: 77.2090, geo_radius: 100 },
  { id: 2, name: 'South Mall Branch', location: '456 Mall Road, South', status: 'active', geo_latitude: 28.5355, geo_longitude: 77.2500, geo_radius: 150 }
];

export default function Branches() {
  const { user } = useAuth();
  const [branches, setBranches] = useState(defaultBranches);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);
  const [formData, setFormData] = useState({
    name: '', location: '', geo_latitude: '', geo_longitude: '', geo_radius: 100, status: 'active'
  });

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    try {
      const res = await branchesAPI.getAll();
      if (res?.data?.success && Array.isArray(res.data.data)) {
        setBranches(res.data.data);
      }
    } catch (error) {
      console.error('Error loading branches:', error);
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await branchesAPI.update(editingBranch.id || editingBranch._id, formData);
      } else {
        await branchesAPI.create(formData);
      }
      loadBranches();
      setShowModal(false);
      resetForm();
    } catch (error) {
      alert(error.response?.data?.message || 'Operation failed');
    }
  };

  const handleEdit = (branch) => {
    setEditingBranch(branch);
    setFormData({
      name: branch.name,
      location: branch.location,
      geo_latitude: branch.geo_latitude || '',
      geo_longitude: branch.geo_longitude || '',
      geo_radius: branch.geo_radius || 100,
      status: branch.status
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this branch?')) {
      await branchesAPI.delete(id);
      loadBranches();
    }
  };

  const resetForm = () => {
    setEditingBranch(null);
    setFormData({ name: '', location: '', geo_latitude: '', geo_longitude: '', geo_radius: 100, status: 'active' });
  };

  if (loading) {
    return <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Branches</h1>
          <p className="text-gray-600">Manage your salon locations</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(branches || []).map((branch) => (
          <div key={branch.id || branch._id} className="card">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-primary-100 rounded-xl">
                <Building2 className="w-6 h-6 text-primary-600" />
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${branch.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                {branch.status}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{branch.name}</h3>
            <p className="text-sm text-gray-600 mt-1 flex items-center gap-1">
              <MapPin className="w-4 h-4" /> {branch.location}
            </p>
            {branch.geo_latitude && (
              <p className="text-xs text-gray-500 mt-2">
                Geo-fence: {branch.geo_radius}m radius
              </p>
            )}
            {user?.role === 'admin' && (
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <button onClick={() => handleEdit(branch)} className="flex-1 btn-secondary text-sm py-2">
                  <Edit className="w-4 h-4 inline mr-1" /> Edit
                </button>
                <button onClick={() => handleDelete(branch.id || branch._id)} className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{editingBranch ? 'Edit' : 'Add'} Branch</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="branchName" className="label">Name</label>
                <input id="branchName" name="name" type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="input" required />
              </div>
              <div>
                <label htmlFor="branchLocation" className="label">Location</label>
                <input id="branchLocation" name="location" type="text" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} className="input" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="branchLat" className="label">Latitude</label>
                  <input id="branchLat" name="geo_latitude" type="number" step="any" value={formData.geo_latitude} onChange={(e) => setFormData({...formData, geo_latitude: e.target.value})} className="input" />
                </div>
                <div>
                  <label htmlFor="branchLng" className="label">Longitude</label>
                  <input id="branchLng" name="geo_longitude" type="number" step="any" value={formData.geo_longitude} onChange={(e) => setFormData({...formData, geo_longitude: e.target.value})} className="input" />
                </div>
              </div>
              <div>
                <label htmlFor="branchRadius" className="label">Geo-fence Radius (meters)</label>
                <input id="branchRadius" name="geo_radius" type="number" value={formData.geo_radius} onChange={(e) => setFormData({...formData, geo_radius: e.target.value})} className="input" />
              </div>
              <div>
                <label htmlFor="branchStatus" className="label">Status</label>
                <select id="branchStatus" name="status" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})} className="input">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn-secondary">Cancel</button>
                <button type="submit" className="flex-1 btn-primary">{editingBranch ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
