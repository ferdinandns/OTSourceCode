import { FC, useState, useEffect, FormEvent } from "react";
import SidebarMenu from '../../../components/SidebarMenu';
import { useNavigate, Link } from 'react-router-dom';
import { useUserCreate } from '../../../hooks/user/useUserCreate';
import { useLokasi } from '../../../hooks/lokasi/useLokasi';

interface ValidationErrors { [key: string]: string; }

const ROLE_OPTIONS = [
    { group: "Group 1 — Superadmin", options: [{ value: "superadmin", label: "Superadmin" }] },
    { group: "Group 2 — Manager", options: [
        { value: "administrator", label: "Administrator" }, { value: "andev_manager", label: "AnDev Manager" },
        { value: "qcts_manager", label: "QC/TS Manager" }, { value: "qa_manager", label: "QA Manager" },
    ]},
    { group: "Group 3 — Supervisor", options: [
        { value: "qc_supervisor", label: "QC Supervisor" }, { value: "andev_supervisor", label: "AnDev Supervisor" },
        { value: "qa_supervisor", label: "QA Supervisor" }, { value: "ts_supervisor", label: "TS Supervisor" },
    ]},
    { group: "Group 4 — Analyst / Staff", options: [
        { value: "qc_analyst_mikro", label: "QC Analyst Mikro" }, { value: "qc_analyst_rm", label: "QC Analyst RM" },
        { value: "qc_analyst_pm", label: "QC Analyst PM" }, { value: "qc_analyst_oj_stabtest", label: "QC Analyst OJ-Stabtest" },
        { value: "qc_analyst_ehm", label: "QC Analyst EHM" }, { value: "qc_analyst_ipc", label: "QC Analyst IPC" },
        { value: "andev_staff", label: "AnDev Staff" }, { value: "qa_staff", label: "QA Staff" }, { value: "ts_staff", label: "TS Staff" },
    ]},
    { group: "Group 5 — User (Read-only)", options: [{ value: "user", label: "User" }] },
];

// Mirror of backend generateUsername — preview only, backend is authoritative
function previewUsername(fullName: string): string {
    const cleaned = fullName.replace(/[^a-zA-Z ]/g, "").trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) return "";
    if (words.length === 1) return words[0].toLowerCase();
    return words[0].toLowerCase() + "." + words[words.length - 1].toLowerCase();
}

const UserCreate: FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const { mutate, isPending } = useUserCreate();
    const { data: allLokasi, isLoading: lokasiLoading } = useLokasi();

    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [usernameEdited, setUsernameEdited] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [lokasiUtamaId, setLokasiUtamaId] = useState<number | null>(null);
    const [lokasiTambahanIds, setLokasiTambahanIds] = useState<number[]>([]);
    const [errors, setErrors] = useState<ValidationErrors>({});

    // Auto-fill username from name unless user has manually edited it
    useEffect(() => {
        if (!usernameEdited) {
            setUsername(previewUsername(name));
        }
    }, [name, usernameEdited]);

    const handleLokasiTambahanChange = (lokasiId: number) => {
        setLokasiTambahanIds(prev =>
            prev.includes(lokasiId) ? prev.filter(id => id !== lokasiId) : [...prev, lokasiId]
        );
    };

    const storeUser = async (e: FormEvent) => {
        e.preventDefault();
        setErrors({});
        if (!lokasiUtamaId) { setErrors({ LokasiUtamaId: "Lokasi utama is required" }); return; }

        mutate({
            name, username, email, password, role,
            lokasi_utama_id: lokasiUtamaId,
            lokasi_tambahan_ids: lokasiTambahanIds,
        }, {
            onSuccess: () => navigate('/admin/users'),
            onError: (error: any) => setErrors(error.response?.data?.errors || { Error: error.message }),
        });
    };

    return (
        <div className="container mt-5 mb-5">
            <SidebarMenu isHorizontal={false} isSidebarOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            <button onClick={() => setIsSidebarOpen(true)} className="btn btn-link text-dark p-0 mb-3" style={{ fontSize: '1.5rem' }}>
                <i className="bi bi-list" />
            </button>
            <div className="card border-0 rounded-4 shadow-sm">
                <div className="card-header fw-bold">ADD USER</div>
                <div className="card-body">
                    <form onSubmit={storeUser}>

                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Full Name *</label>
                            <input type="text" value={name} onChange={e => setName(e.target.value)} className="form-control" placeholder="Full Name" />
                            {errors.Name && <div className="alert alert-danger mt-2 rounded-4">{errors.Name}</div>}
                        </div>

                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Username *</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => { setUsername(e.target.value); setUsernameEdited(true); }}
                                onFocus={() => setUsernameEdited(true)}
                                className="form-control"
                                placeholder="Auto-generated from full name"
                            />
                            <small className="text-muted">
                                Auto-generated as <strong>first.last</strong> from the full name. You can override it.
                            </small>
                            {errors.Username && <div className="alert alert-danger mt-2 rounded-4">{errors.Username}</div>}
                        </div>

                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Email Address *</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="form-control" placeholder="Email Address" />
                            {errors.Email && <div className="alert alert-danger mt-2 rounded-4">{errors.Email}</div>}
                        </div>

                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Password *</label>
                            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="form-control" placeholder="Password (min. 6 characters)" />
                            {errors.Password && <div className="alert alert-danger mt-2 rounded-4">{errors.Password}</div>}
                        </div>

                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Role *</label>
                            <select value={role} onChange={e => setRole(e.target.value)} className="form-select">
                                {ROLE_OPTIONS.map(group => (
                                    <optgroup key={group.group} label={group.group}>
                                        {group.options.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                            <small className="text-muted">User group is automatically assigned based on role.</small>
                            {errors.Role && <div className="alert alert-danger mt-2 rounded-4">{errors.Role}</div>}
                        </div>

                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Lokasi Utama *</label>
                            <select value={lokasiUtamaId || ''} onChange={e => setLokasiUtamaId(e.target.value ? Number(e.target.value) : null)} className="form-select" disabled={lokasiLoading}>
                                <option value="">-- Pilih Lokasi Utama --</option>
                                {allLokasi?.map(lokasi => (
                                    <option key={lokasi.id} value={lokasi.id}>{lokasi.nama} ({lokasi.kode})</option>
                                ))}
                            </select>
                            {errors.LokasiUtamaId && <div className="alert alert-danger mt-2 rounded-4">{errors.LokasiUtamaId}</div>}
                        </div>

                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">
                                Lokasi Tambahan
                                {lokasiTambahanIds.length > 0 && <span className="badge bg-primary ms-2">{lokasiTambahanIds.length} dipilih</span>}
                            </label>
                            <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                                {allLokasi && allLokasi.length > 0 ? allLokasi.map(lokasi => {
                                    const isChecked = lokasiTambahanIds.includes(lokasi.id);
                                    return (
                                        <div key={lokasi.id} className={`form-check mb-2 p-2 rounded ${isChecked ? 'bg-light border border-primary' : ''}`}>
                                            <input className="form-check-input" type="checkbox" id={`lokasi-${lokasi.id}`} checked={isChecked} onChange={() => handleLokasiTambahanChange(lokasi.id)} />
                                            <label className="form-check-label" htmlFor={`lokasi-${lokasi.id}`}>
                                                <strong>{lokasi.nama}</strong> <span className="text-muted">({lokasi.kode})</span>
                                            </label>
                                        </div>
                                    );
                                }) : <p className="text-muted mb-0">Tidak ada lokasi tersedia</p>}
                            </div>
                        </div>

                        {errors.Error && <div className="alert alert-danger rounded-4">{errors.Error}</div>}

                        <button type="submit" className="btn btn-md btn-primary rounded-4 shadow-sm border-0" disabled={isPending}>
                            {isPending ? 'Saving...' : 'Save'}
                        </button>
                        <Link to="/admin/users" className="btn btn-md btn-secondary rounded-4 shadow-sm border-0 ms-2">Cancel</Link>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UserCreate;