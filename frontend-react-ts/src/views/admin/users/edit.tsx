import { FC, useState, useEffect, FormEvent } from "react";
import SidebarMenu from '../../../components/SidebarMenu';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useUserById } from '../../../hooks/user/useUserById';
import { useUserUpdate } from '../../../hooks/user/useUserUpdate';
import { useLokasi } from '../../../hooks/lokasi/useLokasi';

interface ValidationErrors {
    [key: string]: string;
}

const ROLE_OPTIONS = [
    {
        group: "Group 1 — Superadmin", options: [
            { value: "superadmin", label: "Superadmin" },
        ]
    },
    {
        group: "Group 2 — Manager", options: [
            { value: "administrator", label: "Administrator" },
            { value: "andev_manager", label: "AnDev Manager" },
            { value: "qcts_manager", label: "QC/TS Manager" },
            { value: "qa_manager", label: "QA Manager" },
        ]
    },
    {
        group: "Group 3 — Supervisor", options: [
            { value: "qc_supervisor", label: "QC Supervisor" },
            { value: "andev_supervisor", label: "AnDev Supervisor" },
            { value: "qa_supervisor", label: "QA Supervisor" },
            { value: "ts_supervisor", label: "TS Supervisor" },
        ]
    },
    {
        group: "Group 4 — Analyst / Staff", options: [
            { value: "qc_analyst_mikro", label: "QC Analyst Mikro" },
            { value: "qc_analyst_rm", label: "QC Analyst RM" },
            { value: "qc_analyst_pm", label: "QC Analyst PM" },
            { value: "qc_analyst_oj_stabtest", label: "QC Analyst OJ-Stabtest" },
            { value: "qc_analyst_ehm", label: "QC Analyst EHM" },
            { value: "qc_analyst_ipc", label: "QC Analyst IPC" },
            { value: "andev_staff", label: "AnDev Staff" },
            { value: "qa_staff", label: "QA Staff" },
            { value: "ts_staff", label: "TS Staff" },
        ]
    },
    {
        group: "Group 5 — User (Read-only)", options: [
            { value: "user", label: "User" },
        ]
    },
];

const UserEdit: FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('user');
    const [lokasiUtamaId, setLokasiUtamaId] = useState<number | null>(null);
    const [lokasiAktifId, setLokasiAktifId] = useState<number | null>(null);
    const [lokasiTambahanIds, setLokasiTambahanIds] = useState<number[]>([]);
    const [errors, setErrors] = useState<ValidationErrors>({});

    const { data: user, isLoading: userLoading } = useUserById(Number(id));
    const { data: allLokasi, isLoading: lokasiLoading } = useLokasi();
    const { mutate, isPending } = useUserUpdate();

    useEffect(() => {
        if (user) {
            setName(user.name);
            setUsername(user.username);
            setEmail(user.email);
            setRole(user.role || 'user');
            setLokasiUtamaId(user.lokasi_utama_id || null);
            setLokasiAktifId(user.lokasi_aktif_id || null);
            if (user.lokasi_tambahan?.length > 0) {
                setLokasiTambahanIds(user.lokasi_tambahan.map((l: any) => l.id));
            }
        }
    }, [user]);

    const handleLokasiTambahanChange = (lokasiId: number) => {
        setLokasiTambahanIds(prev =>
            prev.includes(lokasiId) ? prev.filter(id => id !== lokasiId) : [...prev, lokasiId]
        );
    };

    const updateUser = async (e: FormEvent) => {
        e.preventDefault();
        setErrors({});

        mutate({
            id: Number(id),
            data: {
                name,
                username,
                email,
                password: password || undefined,
                role,
                lokasi_utama_id: lokasiUtamaId,
                lokasi_aktif_id: lokasiAktifId,
                lokasi_tambahan_ids: lokasiTambahanIds,
            }
        }, {
            onSuccess: () => navigate('/admin/users'),
            onError: (error: any) => setErrors(error.response?.data?.errors || { Error: error.message }),
        });
    };

    if (userLoading || lokasiLoading) {
        return (
            <div className="container mt-5 text-center">
                <div className="spinner-border text-primary" role="status" />
                <p className="mt-2 text-muted">Loading...</p>
            </div>
        );
    }

    return (
        <div className="container mt-2">
            <SidebarMenu isHorizontal={false} isSidebarOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            <button onClick={() => setIsSidebarOpen(true)} className="btn btn-link text-dark p-0 mb-3" style={{ fontSize: '1.5rem' }}>
                <i className="bi bi-list" />
            </button>

            <div className="card border-0 rounded-4 shadow-sm">
                <div className="card-header fw-bold">EDIT USER</div>
                <div className="card-body">
                    <form onSubmit={updateUser}>

                        {/* Full Name */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Full Name *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className={`form-control ${!!user?.name ? 'bg-light text-muted' : ''}`}
                                placeholder="Full Name"
                                readOnly={!!user?.name}
                                style={!!user?.name ? { cursor: 'not-allowed' } : {}}
                            />
                        </div>

                        {/* Username */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Username *</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className={`form-control ${!!user?.username ? 'bg-light text-muted' : ''}`}
                                placeholder="Username"
                                readOnly={!!user?.username}
                                style={!!user?.username ? { cursor: 'not-allowed' } : {}}
                            />
                        </div>

                        {/* Email */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Email Address *</label>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="form-control" placeholder="Email Address" />
                            {errors.Email && <div className="alert alert-danger mt-2 rounded-4">{errors.Email}</div>}
                        </div>

                        {/* Role */}
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
                            <small className="text-muted">User group is automatically assigned based on role</small>
                            {errors.Role && <div className="alert alert-danger mt-2 rounded-4">{errors.Role}</div>}
                        </div>

                        {/* Current lokasi info */}
                        {user && (
                            <div className="alert alert-light border rounded-4 mb-3">
                                <small className="text-muted">
                                    {user.lokasi_utama && `Lokasi Utama: ${user.lokasi_utama.nama} | `}
                                    {user.lokasi_aktif && `Lokasi Aktif: ${user.lokasi_aktif.nama} | `}
                                    {user.lokasi_tambahan?.length > 0 && `Lokasi Tambahan: ${user.lokasi_tambahan.map((l: any) => l.nama).join(', ')}`}
                                    {!user.lokasi_utama && !user.lokasi_aktif && (!user.lokasi_tambahan || user.lokasi_tambahan.length === 0) && 'Belum ada lokasi terdaftar'}
                                </small>
                            </div>
                        )}

                        {/* Lokasi Utama */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Lokasi Utama</label>
                            <select
                                value={lokasiUtamaId || ''}
                                onChange={e => setLokasiUtamaId(e.target.value ? Number(e.target.value) : null)}
                                className="form-select"
                            >
                                <option value="">-- Pilih Lokasi Utama --</option>
                                {allLokasi?.map(lokasi => (
                                    <option key={lokasi.id} value={lokasi.id}>{lokasi.nama} ({lokasi.kode})</option>
                                ))}
                            </select>
                            <small className="text-muted">Lokasi utama adalah lokasi default user</small>
                            {errors.LokasiUtamaId && <div className="alert alert-danger mt-2 rounded-4">{errors.LokasiUtamaId}</div>}
                        </div>

                        {/* Lokasi Aktif */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Lokasi Aktif</label>
                            <select
                                value={lokasiAktifId || ''}
                                onChange={e => setLokasiAktifId(e.target.value ? Number(e.target.value) : null)}
                                className="form-select"
                            >
                                <option value="">-- Pilih Lokasi Aktif --</option>
                                {allLokasi?.map(lokasi => (
                                    <option key={lokasi.id} value={lokasi.id}>{lokasi.nama} ({lokasi.kode})</option>
                                ))}
                            </select>
                            <small className="text-muted">Lokasi yang sedang digunakan saat ini</small>
                            {errors.LokasiAktifId && <div className="alert alert-danger mt-2 rounded-4">{errors.LokasiAktifId}</div>}
                        </div>

                        {/* Lokasi Tambahan */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">
                                Lokasi Tambahan
                                {lokasiTambahanIds.length > 0 && (
                                    <span className="badge bg-primary ms-2">{lokasiTambahanIds.length} dipilih</span>
                                )}
                            </label>
                            <div className="border rounded p-3" style={{ maxHeight: '200px', overflowY: 'auto', backgroundColor: '#f8f9fa' }}>
                                {allLokasi && allLokasi.length > 0 ? allLokasi.map(lokasi => {
                                    const isChecked = lokasiTambahanIds.includes(lokasi.id);
                                    return (
                                        <div key={lokasi.id} className={`form-check mb-2 p-2 rounded ${isChecked ? 'bg-light border border-primary' : ''}`}>
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id={`lokasi-${lokasi.id}`}
                                                checked={isChecked}
                                                onChange={() => handleLokasiTambahanChange(lokasi.id)}
                                            />
                                            <label className="form-check-label" htmlFor={`lokasi-${lokasi.id}`}>
                                                <strong>{lokasi.nama}</strong> <span className="text-muted">({lokasi.kode})</span>
                                            </label>
                                        </div>
                                    );
                                }) : <p className="text-muted mb-0">Tidak ada lokasi tersedia</p>}
                            </div>
                            <small className="text-muted">User dapat mengakses lokasi-lokasi yang dipilih</small>
                        </div>

                        {/* Password */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="form-control"
                                placeholder="Leave blank to keep current password"
                            />
                            <small className="text-muted">Leave blank if you don't want to change the password</small>
                            {errors.Password && <div className="alert alert-danger mt-2 rounded-4">{errors.Password}</div>}
                        </div>

                        {errors.Error && <div className="alert alert-danger rounded-4 mb-3">{errors.Error}</div>}

                        <button type="submit" className="btn btn-md btn-primary rounded-4 shadow-sm border-0" disabled={isPending}>
                            {isPending ? 'Updating...' : 'Update'}
                        </button>
                        <Link to="/admin/users" className="btn btn-md btn-secondary rounded-4 shadow-sm border-0 ms-2">Cancel</Link>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UserEdit;