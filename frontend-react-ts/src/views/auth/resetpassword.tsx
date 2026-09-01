import { FC, useState, FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useResetPassword } from "../../hooks/auth/usePasswordReset";

const ResetPasswordPage: FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as { token: string | null; expires_at?: string } | null;

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const { mutate: doReset, isPending } = useResetPassword();

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        if (newPassword !== confirmPassword) {
            setErrorMsg("Passwords do not match.");
            return;
        }
        if (newPassword.length < 6) {
            setErrorMsg("Password must be at least 6 characters.");
            return;
        }
        if (!state?.token) {
            setErrorMsg("Invalid or missing reset token. Please start over.");
            return;
        }

        doReset({ token: state.token, new_password: newPassword }, {
            onSuccess: () => {
                setSuccessMsg("Password reset successfully! Redirecting to login...");
                setTimeout(() => navigate("/"), 2500);
            },
            onError: (err: any) =>
                setErrorMsg(err.response?.data?.message || "Invalid or expired token."),
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
                                <h2 className="fw-bold text-center mb-2">Reset Password</h2>
                                {state?.expires_at && (
                                    <p className="text-center text-muted mb-4" style={{ fontSize: 13 }}>
                                        Token valid until: {state.expires_at}
                                    </p>
                                )}

                                {successMsg && <div className="alert alert-success rounded-4">{successMsg}</div>}
                                {errorMsg && <div className="alert alert-danger rounded-4">{errorMsg}</div>}

                                {!successMsg && (
                                    <form onSubmit={handleSubmit}>
                                        <div className="mb-3">
                                            <input
                                                type="password"
                                                className="form-control form-control-lg"
                                                placeholder="New Password"
                                                value={newPassword}
                                                onChange={e => setNewPassword(e.target.value)}
                                                required
                                                style={{ borderRadius: "12px", border: "none", fontSize: "18px" }}
                                            />
                                        </div>
                                        <div className="mb-3">
                                            <input
                                                type="password"
                                                className="form-control form-control-lg"
                                                placeholder="Confirm New Password"
                                                value={confirmPassword}
                                                onChange={e => setConfirmPassword(e.target.value)}
                                                required
                                                style={{ borderRadius: "12px", border: "none", fontSize: "18px" }}
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="btn btn-lg w-100 fw-bold mb-3"
                                            disabled={isPending || !state?.token}
                                            style={{
                                                borderRadius: "50px", background: "white",
                                                border: "none", color: "#2d3436",
                                                boxShadow: "0 4px 15px rgba(0,0,0,0.1)"
                                            }}
                                        >
                                            {isPending ? "Resetting..." : "Reset Password"}
                                        </button>
                                        <div className="text-center">
                                            <Link to="/forgot-password" style={{ color: "#2196F3", fontSize: "16px" }}>
                                                Start over
                                            </Link>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordPage;