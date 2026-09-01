import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegisterBridge } from '../../../hooks/bridge/useBridge';
import SidebarMenu from '../../../components/SidebarMenu';


export default function BridgePCCreate() {
  const navigate = useNavigate();
  const registerMutation = useRegisterBridge();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };


  const [form, setForm] = useState({
    pc_id: '',
    hostname: '',
    location: '',
    ip_address: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    registerMutation.mutate(form, {
      onSuccess: () => {
        alert('Bridge PC registered successfully!');
        navigate('/admin/bridge');
      },
      onError: (error: any) => {
        alert('Failed to register: ' + (error?.response?.data?.message || error.message));
      },
    });
  };

  return (
    <div className="container mt-4">
      <div className="d-flex align-items-center">
        <SidebarMenu
          isHorizontal={false}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
        />
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="btn btn-link text-dark p-0 me-3"
          style={{ fontSize: '1.5rem' }}
        >
          <i className="bi bi-list"></i>
        </button>
        <h5 className="mb-0 fw-bold">Register New Bridge PC</h5>
      </div>


      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">PC ID *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., LAB-PC-001"
                value={form.pc_id}
                onChange={(e) => setForm({ ...form, pc_id: e.target.value })}
                required
              />
              <div className="form-text">
                Unique identifier for this PC. This will be used in bridge config.
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label">Hostname *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., COMP-LAB-KIMIA-01"
                value={form.hostname}
                onChange={(e) => setForm({ ...form, hostname: e.target.value })}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Location *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., Laboratorium Kimia Lantai 2"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">IP Address (Optional)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g., 192.168.1.100"
                value={form.ip_address}
                onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
              />
            </div>

            <div className="alert alert-info">
              <i className="bi bi-info-circle me-2"></i>
              <strong>Next Steps:</strong>
              <ol className="mb-0 mt-2">
                <li>After registration, note the PC ID</li>
                <li>On the lab PC, edit bridge config.json with this PC ID</li>
                <li>Start the bridge application</li>
                <li>Assign instruments to this PC</li>
              </ol>
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/admin/bridge')}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={registerMutation.isPending}
              >
                {registerMutation.isPending ? 'Registering...' : 'Register PC'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}