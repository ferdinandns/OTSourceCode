import { FC, useState, useContext, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLogin } from '../../hooks/auth/useLogin';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../services/api';

interface ValidationErrors {
    [key: string]: string;
}

interface Lokasi {
    id: number;
    nama: string;
    kode: string;
}

const Login: FC = () => {
    const navigate = useNavigate();
    const { mutate, isPending } = useLogin();
    const auth = useContext(AuthContext)!;

    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [lokasiId, setLokasiId] = useState<string>('');
    const [allLokasi, setAllLokasi] = useState<Lokasi[]>([]);
    const [isLoadingLokasi, setIsLoadingLokasi] = useState<boolean>(true);
    const [errors, setErrors] = useState<ValidationErrors>({});

    useEffect(() => {
        const fetchLokasi = async () => {
            try {
                const response = await Api.get('/api/lokasi');
                setAllLokasi(response.data.data);
            } catch (error) {
                console.error('Failed to fetch lokasi:', error);
            } finally {
                setIsLoadingLokasi(false);
            }
        };
        fetchLokasi();
    }, []);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();

        const payload: any = { username, password };
        if (lokasiId && lokasiId !== '') {
            payload.lokasi_id = Number(lokasiId);
        }

        mutate(payload, {
            onSuccess: (data: any) => {
                const userData = data.data;

                // Call auth.login with token + user object (includes role & user_group)
                auth.login(userData.token, {
                    id: userData.id,
                    name: userData.name,
                    username: userData.username,
                    email: userData.email,
                    role: userData.role,
                    user_group: userData.user_group,
                    site: userData.lokasi_aktif?.kode,
                    must_change_password: userData.must_change_password,
                });

                navigate('/admin/dashboard');
            },
            onError: (error: any) => {
                const errorData = error?.response?.data;
                const errorMessages = errorData?.errors;

                if (errorMessages && typeof errorMessages === 'object') {
                    // ✅ Also map lokasi_id error to the generic Error key so it shows up
                    if (errorMessages.lokasi_id) {
                        setErrors({ Error: errorMessages.lokasi_id });
                    } else {
                        setErrors(errorMessages);
                    }
                } else if (errorData?.error) {
                    setErrors({ Error: errorData.error });
                } else if (errorData?.message) {
                    setErrors({ Error: errorData.message });
                } else {
                    setErrors({ Error: 'Login failed. Please try again.' });
                }
            }
        });
    };

    return (
        <div className="min-vh-100 d-flex align-items-center" style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' }}>
            <div className="container">
                <div className="row justify-content-center" style={{ marginBottom: '50px' }}>
                    <div className="col-md-8 col-lg-4">
                        <div className="card border-0 shadow-lg" style={{ borderRadius: '20px', background: '#f1f8e9' }}>
                            <div className="card-body p-5">
                                <h2 className='fw-bold text-center mb-4'>Lab-Connect</h2>

                                {errors.Error && (
                                    <div className="alert alert-danger mb-3" style={{ borderRadius: '10px' }}>
                                        {errors.Error}
                                    </div>
                                )}

                                <form onSubmit={handleLogin}>
                                    <div className="mb-2">
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="form-control form-control-lg"
                                            placeholder="Username"
                                            style={{ borderRadius: '12px', border: 'none', padding: '5px 10px', fontSize: '18px' }}
                                        />
                                    </div>

                                    <div className="mb-2">
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="form-control form-control-lg"
                                            placeholder="Password"
                                            style={{ borderRadius: '12px', border: 'none', padding: '5px 10px', fontSize: '18px' }}
                                        />
                                    </div>

                                    <div className="mb-2">
                                        <select
                                            value={lokasiId}
                                            onChange={(e) => setLokasiId(e.target.value)}
                                            className="form-select form-select-lg"
                                            disabled={isLoadingLokasi}
                                            style={{
                                                borderRadius: '12px',
                                                border: 'none',
                                                padding: '15px 20px',
                                                fontSize: '18px',
                                                appearance: 'none',
                                                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%235e81ac' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'right 15px center',
                                                backgroundSize: '24px',
                                                paddingRight: '50px'
                                            }}
                                        >
                                            <option value="">Lokasi Site (Default: Lokasi Utama)</option>
                                            {allLokasi.map((lokasi) => (
                                                <option key={lokasi.id} value={lokasi.id}>
                                                    {lokasi.nama}
                                                </option>
                                            ))}
                                        </select>
                                        <small className="text-muted d-block mt-1" style={{ fontSize: '12px' }}>
                                            Optional - Kosongkan untuk menggunakan lokasi utama
                                        </small>
                                    </div>

                                    <div className="text-end mb-2">
                                        <Link to="/forgot-password" style={{ color: '#2196F3', textDecoration: 'underline', fontSize: '16px' }}>
                                            Forgot Password?
                                        </Link>
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-lg w-100 fw-bold mb-3"
                                        disabled={isPending || isLoadingLokasi}
                                        style={{
                                            borderRadius: '50px',
                                            padding: '10px',
                                            fontSize: '20px',
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
                                        {isPending ? 'Loading...' : 'Log In'}
                                    </button>

                                    <div className="text-center">
                                        <Link to="/register" style={{ color: '#2196F3', textDecoration: 'underline', fontSize: '16px' }}>
                                            Register New Account
                                        </Link>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;