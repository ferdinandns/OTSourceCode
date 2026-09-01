import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Cookies from "js-cookie";
import { useProfileUpdate } from "../hooks/user/useProfile";
import { useAuthUser } from "../hooks/auth/useAuthUser";
 
export const ChangePasswordPage = () => {
    const authUser = useAuthUser();
    const navigate = useNavigate();
    const location = useLocation();
    const { mutate: updateProfile, isPending, isError, error } = useProfileUpdate();
 
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [validationError, setValidationError] = useState<string | null>(null);
 
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/dashboard";
 
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setValidationError(null);
 
        if (newPassword.length < 6) {
            setValidationError("New password must be at least 6 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setValidationError("New passwords do not match.");
            return;
        }
 
        updateProfile(
            { current_password: currentPassword, 
                new_password: newPassword, 
                 username: authUser?.username ?? "",},
            {
                onSuccess: () => {
                    // Clear the must_change_password flag in the cookie
                    const raw = Cookies.get("user");
                    if (raw) {
                        try {
                            const user = JSON.parse(raw);
                            user.must_change_password = false;
                            Cookies.set("user", JSON.stringify(user), { expires: 1 });
                        } catch {
                            // ignore parse errors
                        }
                    }
                    navigate(from, { replace: true });
                },
            }
        );
    };
 
    return (
        <div style={{ maxWidth: 400, margin: "10vh auto", padding: "2rem" }}>
            <h1 style={{ fontSize: 22, fontWeight: 500, marginBottom: "0.5rem" }}>
                Update your password
            </h1>
            <p style={{ color: "var(--color-text-secondary)", marginBottom: "1.5rem", fontSize: 14 }}>
                Your password has expired or was set by an administrator. Please choose a new password to continue.
            </p>
 
            <form onSubmit={handleSubmit}>
                <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>
                    Current password
                </label>
                <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    style={{ width: "100%", marginBottom: 16 }}
                />
 
                <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>
                    New password
                </label>
                <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{ width: "100%", marginBottom: 16 }}
                />
 
                <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>
                    Confirm new password
                </label>
                <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    style={{ width: "100%", marginBottom: 20 }}
                />
 
                {validationError && (
                    <p style={{ color: "var(--color-text-danger)", fontSize: 13, marginBottom: 12 }}>
                        {validationError}
                    </p>
                )}
                {isError && (
                    <p style={{ color: "var(--color-text-danger)", fontSize: 13, marginBottom: 12 }}>
                        {(error as Error)?.message ?? "Failed to update password. Check your current password."}
                    </p>
                )}
 
                <button type="submit" disabled={isPending} style={{ width: "100%" }}>
                    {isPending ? "Saving…" : "Set new password"}
                </button>
            </form>
        </div>
    );
};