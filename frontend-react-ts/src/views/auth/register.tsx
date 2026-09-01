import { FC, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRegister } from '../../hooks/auth/useRegister';
import { useLokasi } from '../../hooks/lokasi/useLokasi';

interface ValidationErrors {
    [key: string]: string;
}

// Mirrors the Go generateUsername logic:
// 1. Strip non A-Z/a-z/space characters (normalise accents client-side best-effort)
// 2. Split words, take first and last
// 3. Join with dot, lowercase
function previewUsername(fullName: string): string {
    // Best-effort diacritic strip in the browser
    const normalized = fullName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cleaned = normalized.replace(/[^a-zA-Z ]/g, '').trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length === 0) return '';
    if (words.length === 1) return words[0].toLowerCase();
    return (words[0] + '.' + words[words.length - 1]).toLowerCase();
}

const Register: FC = () => {
    const navigate = useNavigate();
    const { mutate, isPending } = useRegister();
    const { data: lokasiList, isLoading: isLoadingLokasi } = useLokasi();

    const [firstName, setFirstName] = useState<string>('');
    const [lastName, setLastName] = useState<string>('');
    const [email, setEmail] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [lokasiUtamaId, setLokasiUtamaId] = useState<number>(0);
    const [lokasiTambahanIds, setLokasiTambahanIds] = useState<number[]>([]);
    const [showLokasiTambahan, setShowLokasiTambahan] = useState<boolean>(false);
    const [errors, setErrors] = useState<ValidationErrors>({});

    // Derived — never stored separately, always in sync with name
    const usernamePreview = previewUsername(`${firstName} ${lastName}`.trim());


    const handleLokasiTambahanToggle = (lokasiId: number) => {
        setLokasiTambahanIds(prev =>
            prev.includes(lokasiId)
                ? prev.filter(id => id !== lokasiId)
                : [...prev, lokasiId]
        );
    };

    const handleRegister = async (e: FormEvent) => {
        e.preventDefault();

        // Send without username — backend auto-generates and deduplicates
        mutate({
            name: `${firstName} ${lastName}`.trim(),
            email,
            password,
            lokasi_utama_id: lokasiUtamaId,
            lokasi_tambahan_ids: lokasiTambahanIds,
        }, {
            onSuccess: () => {
                navigate('/');
            },
            onError: (error: any) => {
                const errorData = error?.response?.data;
                const errorMessages = errorData?.errors || errorData?.error;
                if (errorMessages) {
                    setErrors(errorMessages);
                } else if (errorData?.message) {
                    setErrors({ general: errorData.message });
                } else {
                    setErrors({ general: 'Terjadi kesalahan. Silakan coba lagi.' });
                }
            }
        });
    };

    const inputStyle = {
        borderRadius: '10px',
        border: 'none',
        padding: '12px 16px',
        fontSize: '15px',
        transition: 'all 0.2s',
        background: 'white'
    };

    return (
        <div className="min-vh-100 d-flex py-4" style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' }}>
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-md-8 col-lg-6">
                        <div className="card border-0 shadow-lg" style={{ borderRadius: '16px', background: '#f1f8e9' }}>
                            <div className="card-body p-3 p-md-4">
                                <h2 className='fw-bold text-center mb-1' style={{ color: '#2d3436' }}>Lab-Connect</h2>
                                <p className='text-center text-muted mb-2' style={{ fontSize: '13px' }}>Create your account</p>

                                <form onSubmit={handleRegister}>
                                    <div className="row">
                                        {/* Full Name */}
                                        <div className="col-6 mb-1">
                                            <label className="form-label fw-semibold" style={{ fontSize: '13px', color: '#555' }}>
                                                First Name <span style={{ color: 'red' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                className="form-control"
                                                placeholder="First name"
                                                style={inputStyle}
                                            />
                                            {errors.Name && (
                                                <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{errors.Name}</div>
                                            )}
                                        </div>

                                        <div className="col-6 mb-1">
                                            <label className="form-label fw-semibold" style={{ fontSize: '13px', color: '#555' }}>
                                                Last Name <span style={{ color: 'red' }}>*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                className="form-control"
                                                placeholder="Last name"
                                                style={inputStyle}
                                            />
                                            {/* ← tambahan hint */}
                                            <small className="text-muted d-block mt-1" style={{ fontSize: '10px' }}>
                                                Boleh disamakan dengan first name jika nama hanya 1 kata.
                                            </small>
                                        </div>
                                        {/* Username preview — read-only */}
                                        <div className="col-12 mb-1">
                                            <label className="form-label fw-semibold" style={{ fontSize: '13px', color: '#555' }}>
                                                Username
                                                <span className="fw-normal text-muted ms-1" style={{ fontSize: '12px' }}>(auto-generated)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={usernamePreview || ''}
                                                readOnly
                                                className="form-control"
                                                placeholder="Will be generated from your full name"
                                                style={{
                                                    ...inputStyle,
                                                    background: '#e9ecef',
                                                    color: usernamePreview ? '#2d3436' : '#aaa',
                                                    cursor: 'not-allowed',
                                                }}
                                            />
                                            {usernamePreview && (
                                                <small className="text-muted d-block mt-1" style={{ fontSize: '12px' }}>
                                                    Your username will be <strong>{usernamePreview}</strong>. A number may be added if already taken.
                                                </small>
                                            )}
                                        </div>

                                        {/* Email */}
                                        <div className="col-md-6 mb-1">
                                            <label className="form-label fw-semibold" style={{ fontSize: '13px', color: '#555' }}>Email</label>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="form-control"
                                                placeholder="your@email.com"
                                                style={inputStyle}
                                            />
                                            {errors.Email && (
                                                <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{errors.Email}</div>
                                            )}
                                        </div>

                                        {/* Password */}
                                        <div className="col-md-6 mb-1">
                                            <label className="form-label fw-semibold" style={{ fontSize: '13px', color: '#555' }}>Password</label>
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="form-control"
                                                placeholder="Create password"
                                                style={inputStyle}
                                            />
                                            {errors.Password && (
                                                <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{errors.Password}</div>
                                            )}
                                        </div>

                                        {/* Lokasi Site Utama */}
                                        <div className="col-12 mb-1">
                                            <label className="form-label fw-semibold" style={{ fontSize: '13px', color: '#555' }}>Lokasi Site Utama</label>
                                            <select
                                                value={lokasiUtamaId}
                                                onChange={(e) => setLokasiUtamaId(Number(e.target.value))}
                                                className="form-select"
                                                disabled={isLoadingLokasi}
                                                style={inputStyle}
                                            >
                                                <option value={0}>Select primary location</option>
                                                {lokasiList?.map(lokasi => (
                                                    <option key={lokasi.id} value={lokasi.id}>{lokasi.nama}</option>
                                                ))}
                                            </select>
                                            {errors.LokasiUtamaId && (
                                                <div className="text-danger mt-1" style={{ fontSize: '12px' }}>{errors.LokasiUtamaId}</div>
                                            )}
                                        </div>

                                        {/* Lokasi Site Tambahan */}
                                        <div className="col-12 mb-1">
                                            <label className="form-label fw-semibold" style={{ fontSize: '13px', color: '#555' }}>
                                                Lokasi Site Tambahan <span className="fw-normal text-muted">(Optional)</span>
                                            </label>
                                            <div
                                                className="border rounded p-3"
                                                style={{
                                                    background: '#f8f9fa',
                                                    maxHeight: showLokasiTambahan ? '250px' : '60px',
                                                    overflow: 'hidden',
                                                    transition: 'max-height 0.3s ease'
                                                }}
                                            >
                                                <div
                                                    className="d-flex justify-content-between align-items-center"
                                                    style={{ cursor: 'pointer' }}
                                                    onClick={() => setShowLokasiTambahan(!showLokasiTambahan)}
                                                >
                                                    <span style={{ fontSize: '14px', color: '#666' }}>
                                                        {lokasiTambahanIds.length === 0
                                                            ? 'Click to select additional locations'
                                                            : `${lokasiTambahanIds.length} location${lokasiTambahanIds.length > 1 ? 's' : ''} selected`
                                                        }
                                                    </span>
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"
                                                        style={{ transform: showLokasiTambahan ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                                                        <polyline points="6 9 12 15 18 9"></polyline>
                                                    </svg>
                                                </div>
                                                {showLokasiTambahan && (
                                                    <div className="mt-3" style={{ maxHeight: '180px', overflowY: 'auto', paddingRight: '8px' }}>
                                                        {isLoadingLokasi ? (
                                                            <div className="text-center py-3">
                                                                <div className="spinner-border spinner-border-sm" role="status">
                                                                    <span className="visually-hidden">Loading...</span>
                                                                </div>
                                                            </div>
                                                        ) : lokasiList && lokasiList.length > 0 ? (
                                                            lokasiList
                                                                .filter(lokasi => lokasi.id !== lokasiUtamaId)
                                                                .map(lokasi => (
                                                                    <div
                                                                        key={lokasi.id}
                                                                        className="form-check mb-2"
                                                                        style={{
                                                                            padding: '8px 12px',
                                                                            background: lokasiTambahanIds.includes(lokasi.id) ? '#e8f5e9' : 'white',
                                                                            borderRadius: '6px',
                                                                            transition: 'all 0.2s',
                                                                            cursor: 'pointer'
                                                                        }}
                                                                        onClick={() => handleLokasiTambahanToggle(lokasi.id)}
                                                                    >
                                                                        <input
                                                                            className="form-check-input"
                                                                            type="checkbox"
                                                                            id={`lokasi-${lokasi.id}`}
                                                                            checked={lokasiTambahanIds.includes(lokasi.id)}
                                                                            onChange={() => handleLokasiTambahanToggle(lokasi.id)}
                                                                            style={{ cursor: 'pointer' }}
                                                                        />
                                                                        <label
                                                                            className="form-check-label"
                                                                            htmlFor={`lokasi-${lokasi.id}`}
                                                                            style={{ cursor: 'pointer', fontSize: '14px', marginLeft: '4px' }}
                                                                        >
                                                                            {lokasi.nama}
                                                                        </label>
                                                                    </div>
                                                                ))
                                                        ) : (
                                                            <p className="text-muted mb-0" style={{ fontSize: '13px' }}>No additional locations available</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {errors.general && (
                                        <div className="alert alert-danger mb-3 py-2" style={{ borderRadius: '8px', fontSize: '13px' }}>
                                            {errors.general}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className="btn btn-lg w-100 fw-bold mt-2"
                                        disabled={isPending || isLoadingLokasi}
                                        style={{
                                            borderRadius: '50px',
                                            padding: '12px',
                                            fontSize: '18px',
                                            background: 'white',
                                            border: 'none',
                                            color: '#2d3436',
                                            boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
                                            transition: 'all 0.3s'
                                        }}
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.transform = 'translateY(-2px)';
                                            e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.transform = 'translateY(0)';
                                            e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)';
                                        }}
                                    >
                                        {isPending ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Loading...
                                            </>
                                        ) : 'Register'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;