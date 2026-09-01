import { FC, useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForgotPassword } from "../../hooks/auth/usePasswordReset";

const ForgotPasswordPage: FC = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const { mutate: requestToken, isPending } = useForgotPassword();

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        requestToken({ username }, {
            onSuccess: (res) => {
                if (res.data?.token) {
                    // Username valid — arahkan ke change-password dengan token di state
                    navigate("/reset-password", {
                        state: {
                            token: res.data.token,
                            expires_at: res.data.expires_at,
                        }
                    });
                } else {
                    // Username tidak ditemukan — tetap redirect agar tidak bocorkan info
                    navigate("/reset-password", { state: { token: null } });
                }
            },
            onError: (err: any) =>
                setErrorMsg(err.response?.data?.message || "Something went wrong."),
        });
    };

    return (
        <div className="min-vh-100 d-flex align-items-center"
            style={{ background: "linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)" }}>
            <div className="container">
                <div className="row justify-content-center">
                    <div className="col-md-8 col-lg-4">
                        <div className="card border-0 shadow-lg"
                            style={{ borderRadius: "20px", background: "#f1f8e9" }}>
                            <div className="card-body p-5">
                                <h2 className="fw-bold text-center mb-2">Forgot Password</h2>
                                <p className="text-center text-muted mb-4" style={{ fontSize: 14 }}>
                                    Enter your username to continue
                                </p>

                                {errorMsg && (
                                    <div className="alert alert-danger rounded-4">{errorMsg}</div>
                                )}

                                <form onSubmit={handleSubmit}>
                                    <div className="mb-3">
                                        <input
                                            type="text"
                                            className="form-control form-control-lg"
                                            placeholder="Username"
                                            value={username}
                                            onChange={e => setUsername(e.target.value)}
                                            required
                                            style={{ borderRadius: "12px", border: "none", fontSize: "18px" }}
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="btn btn-lg w-100 fw-bold mb-3"
                                        disabled={isPending}
                                        style={{
                                            borderRadius: "50px", background: "white",
                                            border: "none", color: "#2d3436",
                                            boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
                                        }}
                                    >
                                        {isPending ? "Please wait..." : "Continue"}
                                    </button>
                                    <div className="text-center">
                                        <Link to="/" style={{ color: "#2196F3", fontSize: "16px" }}>
                                            Back to Login
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

export default ForgotPasswordPage;