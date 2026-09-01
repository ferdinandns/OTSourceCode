import { FC, useState, useEffect, FormEvent } from "react";
import SidebarMenu from '../../components/SidebarMenu';
import { useProfile, useProfileUpdate } from '../../hooks/user/useProfile';
import { useQueryClient } from '@tanstack/react-query';

interface ValidationErrors {
    [key: string]: string;
}

const GROUP_LABELS: Record<number, string> = {
    1: "Superadmin",
    2: "Manager",
    3: "Supervisor",
    4: "Analyst / Staff",
    5: "User",
};

const GROUP_BADGE_CLASS: Record<number, string> = {
    1: "bg-danger",
    2: "bg-primary",
    3: "bg-success",
    4: "bg-warning text-dark",
    5: "bg-secondary",
};

const ProfileEdit: FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const queryClient = useQueryClient();

    const { data: profile, isLoading } = useProfile();
    const { mutate, isPending } = useProfileUpdate();

    const [username, setUsername] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        if (profile) {
            setUsername(profile.username);
        }
    }, [profile]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        setErrors({});
        setMessage(null);

        // Client-side: confirm password check
        if (newPassword && newPassword !== confirmPassword) {
            setErrors({ ConfirmPassword: "New password and confirmation do not match" });
            return;
        }

        mutate(
            {
                username,
                current_password: currentPassword,
                new_password: newPassword || undefined,
            },
            {
                onSuccess: () => {
                    setMessage({ type: 'success', text: 'Profile updated successfully!' });
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    queryClient.invalidateQueries({ queryKey: ['profile'] });
                    setTimeout(() => setMessage(null), 4000);
                },
                onError: (error: any) => {
                    setErrors(error.response?.data?.errors || { Error: error.message });
                },
            }
        );
    };

    if (isLoading) {
        return (
            <div className="container mt-5 text-center">
                <div className="spinner-border text-primary" role="status" />
                <p className="mt-2 text-muted">Loading profile...</p>
            </div>
        );
    }

    return (
        <div className="container mt-4" style={{ maxWidth: '680px' }}>
            <SidebarMenu
                isHorizontal={false}
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />
            <button
                onClick={() => setIsSidebarOpen(true)}
                className="btn btn-link text-dark p-0 mb-3"
                style={{ fontSize: '1.5rem' }}
            >
                <i className="bi bi-list" />
            </button>

            {/* Profile summary card */}
            <div className="card border-0 rounded-4 shadow-sm mb-4">
                <div className="card-body d-flex align-items-center gap-3 p-4">
                    <div
                        className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white fw-bold flex-shrink-0"
                        style={{ width: 56, height: 56, fontSize: '1.4rem' }}
                    >
                        {profile?.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                        <div className="fw-bold fs-5 mb-1">{profile?.name}</div>
                        <div className="text-muted small mb-1">{profile?.email}</div>
                        <span className={`badge ${GROUP_BADGE_CLASS[profile?.user_group] ?? 'bg-secondary'} me-2`}>
                            {GROUP_LABELS[profile?.user_group] ?? `Group ${profile?.user_group}`}
                        </span>
                        <span className="badge bg-light text-dark border">{profile?.role}</span>
                    </div>
                </div>
            </div>

            {/* Edit form */}
            <div className="card border-0 rounded-4 shadow-sm">
                <div className="card-header fw-bold">
                    <i className="bi bi-person-gear me-2" />EDIT PROFILE
                </div>
                <div className="card-body p-4">

                    {message && (
                        <div
                            className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show rounded-4`}
                            role="alert"
                        >
                            <i className={`bi bi-${message.type === 'success' ? 'check-circle' : 'exclamation-triangle'} me-2`} />
                            {message.text}
                            <button type="button" className="btn-close" onClick={() => setMessage(null)} />
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>

                        {/* Read-only info */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold text-muted small">Full Name</label>
                            <input
                                type="text"
                                className="form-control bg-light"
                                value={profile?.name ?? ''}
                                disabled
                            />
                            <small className="text-muted">Name can only be changed by an administrator</small>
                        </div>

                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold text-muted small">Email Address</label>
                            <input
                                type="email"
                                className="form-control bg-light"
                                value={profile?.email ?? ''}
                                disabled
                            />
                            <small className="text-muted">Email can only be changed by an administrator</small>
                        </div>

                        {/* Editable: Username */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                className="form-control bg-light"
                                placeholder="Username"
                                readOnly
                                disabled
                            />
                            {errors.Username && (
                                <div className="alert alert-danger mt-2 rounded-4">{errors.Username}</div>
                            )}
                        </div>

                        <hr className="my-4" />
                        <p className="fw-bold mb-1">Change Password</p>
                        <p className="text-muted small mb-3">Leave new password blank to keep your current password</p>

                        {/* Current password — always required to confirm identity */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">Current Password *</label>
                            <input
                                type="password"
                                value={currentPassword}
                                onChange={e => setCurrentPassword(e.target.value)}
                                className={`form-control ${errors.CurrentPassword ? 'is-invalid' : ''}`}
                                placeholder="Enter your current password to confirm changes"
                            />
                            {errors.CurrentPassword && (
                                <div className="alert alert-danger mt-2 rounded-4">{errors.CurrentPassword}</div>
                            )}
                        </div>

                        {/* New password */}
                        <div className="form-group mb-3">
                            <label className="mb-1 fw-bold">New Password</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className={`form-control ${errors.NewPassword ? 'is-invalid' : ''}`}
                                placeholder="Leave blank to keep current password (min. 6 characters)"
                            />
                            {errors.NewPassword && (
                                <div className="alert alert-danger mt-2 rounded-4">{errors.NewPassword}</div>
                            )}
                        </div>

                        {/* Confirm new password */}
                        <div className="form-group mb-4">
                            <label className="mb-1 fw-bold">Confirm New Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className={`form-control ${errors.ConfirmPassword ? 'is-invalid' : ''}`}
                                placeholder="Repeat new password"
                            />
                            {errors.ConfirmPassword && (
                                <div className="alert alert-danger mt-2 rounded-4">{errors.ConfirmPassword}</div>
                            )}
                        </div>

                        {errors.Error && (
                            <div className="alert alert-danger rounded-4 mb-3">{errors.Error}</div>
                        )}

                        <button
                            type="submit"
                            className="btn btn-md btn-primary rounded-4 shadow-sm border-0"
                            disabled={isPending}
                        >
                            {isPending
                                ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</>
                                : <><i className="bi bi-check-lg me-1" />Save Changes</>
                            }
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfileEdit;