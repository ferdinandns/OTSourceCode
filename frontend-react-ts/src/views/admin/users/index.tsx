import { FC, useState } from "react";
import SidebarMenu from '../../../components/SidebarMenu';
import { Link } from "react-router-dom";
import { useUsers, User } from "../../../hooks/user/useUsers";
import { useUserDelete } from "../../../hooks/user/useUserDelete";
import { useUserStatusUpdate } from "../../../hooks/user/useUserStatusUpdate";
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from "../../../context/AuthContext";

const GROUP_LABELS: Record<number, string> = { 1: "Superadmin", 2: "Manager", 3: "Supervisor", 4: "Analyst/Staff", 5: "User" };
const GROUP_BADGE_CLASS: Record<number, string> = { 1: "bg-danger", 2: "bg-primary", 3: "bg-success", 4: "bg-warning text-dark", 5: "bg-secondary" };
const ROLE_LABELS: Record<string, string> = {
    superadmin: "Superadmin", administrator: "Administrator", andev_manager: "AnDev Manager",
    qcts_manager: "QC/TS Manager", qa_manager: "QA Manager", qc_supervisor: "QC Supervisor",
    andev_supervisor: "AnDev Supervisor", qa_supervisor: "QA Supervisor", ts_supervisor: "TS Supervisor",
    qc_analyst_mikro: "QC Analyst Mikro", qc_analyst_rm: "QC Analyst RM", qc_analyst_pm: "QC Analyst PM",
    qc_analyst_oj_stabtest: "QC Analyst OJ-Stabtest", qc_analyst_ehm: "QC Analyst EHM",
    qc_analyst_ipc: "QC Analyst IPC", andev_staff: "AnDev Staff", qa_staff: "QA Staff",
    ts_staff: "TS Staff", user: "User",
};
const STATUS_BADGE: Record<string, string> = {
    active: "bg-success",
    pending: "bg-warning text-dark",
    deactive: "bg-secondary",
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const UsersIndex: FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { data: users, isLoading, isError, error } = useUsers();
    const queryClient = useQueryClient();
    const { mutate: deleteUser, isPending: isDeleting } = useUserDelete();
    const { mutate: updateStatus, isPending: isStatusUpdating } = useUserStatusUpdate();
    const { isSupervisorOrAbove } = useAuth();
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // --- Pagination state ---
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const showMsg = (type: 'success' | 'error', text: string) => {
        setMessage({ type, text });
        setTimeout(() => setMessage(null), 3000);
    };

    const handleDelete = (id: number, username: string) => {
        if (confirm(`Are you sure you want to delete user "${username}"?`)) {
            deleteUser(id, {
                onSuccess: () => {
                    showMsg('success', `User "${username}" deleted successfully!`);
                    queryClient.invalidateQueries({ queryKey: ['users'] });
                },
                onError: (err: any) => showMsg('error', err?.response?.data?.message || 'Failed to delete user'),
            });
        }
    };

    const handleStatusChange = (id: number, newStatus: "active" | "pending" | "deactive", username: string) => {
        updateStatus({ id, status: newStatus }, {
            onSuccess: () => showMsg('success', `User "${username}" status updated to ${newStatus}.`),
            onError: (err: any) => showMsg('error', err?.response?.data?.message || 'Failed to update status'),
        });
    };
    const [searchQuery, setSearchQuery] = useState("");

    const filteredUsers = users?.filter((user: User) => {
        const q = searchQuery.toLowerCase();
        return (
            user.name.toLowerCase().includes(q) ||
            user.username.toLowerCase().includes(q) ||
            user.email.toLowerCase().includes(q) ||
            (ROLE_LABELS[user.role] ?? user.role).toLowerCase().includes(q)
        );
    }).sort((a, b) => a.name.localeCompare(b.name)) ?? [];

    // --- Pagination logic ---
    const totalUsers = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedUsers = filteredUsers.slice((safePage - 1) * pageSize, safePage * pageSize);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchQuery(e.target.value);
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setCurrentPage(1);
    };

    // Page number buttons (show up to 5 around current page)
    const getPageNumbers = () => {
        const delta = 2;
        const range: number[] = [];
        for (let i = Math.max(1, safePage - delta); i <= Math.min(totalPages, safePage + delta); i++) {
            range.push(i);
        }
        return range;
    };

    const startEntry = totalUsers === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const endEntry = Math.min(safePage * pageSize, totalUsers);

    return (
        <div className="container mt-4">
            <SidebarMenu isHorizontal={false} isSidebarOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
            <button onClick={() => setIsSidebarOpen(true)} className="btn btn-link text-dark p-0 mb-3" style={{ fontSize: '1.5rem' }}>
                <i className="bi bi-list" />
            </button>
            <div className="card border-0 rounded-4 shadow-sm">
                <div className="card-header d-flex justify-content-between align-items-center">
                    <span className="fw-bold">USERS</span>
                    <Link to="/admin/users/create" className="btn btn-sm btn-primary rounded-4">
                        <i className="bi bi-plus-lg me-1" /> Add User
                    </Link>
                </div>
                <div className="card-body">
                    {message && (
                        <div className={`alert alert-${message.type === 'success' ? 'success' : 'danger'} alert-dismissible fade show rounded-4`} role="alert">
                            {message.text}
                            <button type="button" className="btn-close" onClick={() => setMessage(null)} />
                        </div>
                    )}
                    {isLoading && <div className="text-center py-5"><div className="spinner-border text-primary" role="status" /><p className="mt-2 text-muted">Loading users...</p></div>}
                    {isError && <div className="alert alert-danger rounded-4"><i className="bi bi-exclamation-triangle me-2" />Error: {(error as any)?.message}</div>}
                    {!isLoading && !isError && (users && users.length > 0 ? (
                        <>

                            {/* Rows per page selector */}
                            <div className="d-flex align-items-center justify-content-between gap-2 mb-3 flex-wrap">
                                <div className="input-group input-group-sm" style={{ maxWidth: 360 }}>
                                    <span className="input-group-text bg-white border-end-0">
                                        <i className="bi bi-search text-muted" />
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0"
                                        placeholder="Search name, username, email, role..."
                                        value={searchQuery}
                                        onChange={handleSearchChange}
                                    />
                                    {searchQuery && (
                                        <button
                                            className="btn btn-outline-secondary"
                                            onClick={() => { setSearchQuery(""); setCurrentPage(1); }}
                                            title="Clear"
                                        >
                                            <i className="bi bi-x" />
                                        </button>
                                    )}
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <label className="form-label mb-0 text-muted small">Rows per page:</label>
                                    <select
                                        className="form-select form-select-sm rounded-3"
                                        style={{ width: 'auto' }}
                                        value={pageSize}
                                        onChange={e => handlePageSizeChange(Number(e.target.value))}
                                    >
                                        {PAGE_SIZE_OPTIONS.map(size => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="table-responsive">
                                <table className="table table-hover table-bordered">
                                    <thead className="table-dark">
                                        <tr>
                                            <th>Full Name</th><th>Username</th><th>Email</th>
                                            <th>Group</th><th>Role</th><th>Status</th>
                                            <th className="text-center" style={{ width: '22%' }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedUsers.map((user: User) => (
                                            <tr key={user.id}>
                                                <td>{user.name}</td>
                                                <td>{user.username}</td>
                                                <td>{user.email}</td>
                                                <td><span className={`badge ${GROUP_BADGE_CLASS[user.user_group] ?? 'bg-secondary'}`}>{GROUP_LABELS[user.user_group] ?? `Group ${user.user_group}`}</span></td>
                                                <td><small className="text-muted">{ROLE_LABELS[user.role] ?? user.role}</small></td>
                                                <td>
                                                    {isSupervisorOrAbove() ? (
                                                        <select
                                                            className="form-select form-select-sm rounded-3"
                                                            value={(user as any).status ?? 'active'}
                                                            onChange={e => handleStatusChange(user.id, e.target.value as any, user.username)}
                                                            disabled={isStatusUpdating}
                                                            style={{ minWidth: 110 }}
                                                        >
                                                            <option value="active">Active</option>
                                                            <option value="pending">Pending</option>
                                                            <option value="deactive">Deactive</option>
                                                        </select>
                                                    ) : (
                                                        <span className={`badge ${STATUS_BADGE[(user as any).status ?? 'active']}`}>
                                                            {((user as any).status ?? 'active').charAt(0).toUpperCase() + ((user as any).status ?? 'active').slice(1)}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="text-center">
                                                    <Link to={`/admin/users/edit/${user.id}`} className="btn btn-sm btn-primary rounded-4 shadow-sm border-0 me-2">
                                                        <i className="bi bi-pencil me-1" /> EDIT
                                                    </Link>
                                                    <button onClick={() => handleDelete(user.id, user.username)} disabled={isDeleting} className="btn btn-sm btn-danger rounded-4 shadow-sm border-0">
                                                        {isDeleting ? <><span className="spinner-border spinner-border-sm me-1" />DELETING...</> : <><i className="bi bi-trash me-1" />DELETE</>}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination controls */}
                            <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
                                <small className="text-muted">
                                    Showing {startEntry}–{endEntry} of {totalUsers} users
                                    {searchQuery && ` (filtered from ${users?.length ?? 0})`}
                                </small>
                                <nav aria-label="Users pagination">
                                    <ul className="pagination pagination-sm mb-0">
                                        {/* First */}
                                        <li className={`page-item ${safePage === 1 ? 'disabled' : ''}`}>
                                            <button className="page-link rounded-3 me-1" onClick={() => handlePageChange(1)} aria-label="First">«</button>
                                        </li>
                                        {/* Prev */}
                                        <li className={`page-item ${safePage === 1 ? 'disabled' : ''}`}>
                                            <button className="page-link rounded-3 me-1" onClick={() => handlePageChange(safePage - 1)} aria-label="Previous">‹</button>
                                        </li>
                                        {/* Page numbers */}
                                        {getPageNumbers().map(page => (
                                            <li key={page} className={`page-item ${page === safePage ? 'active' : ''}`}>
                                                <button className="page-link rounded-3 me-1" onClick={() => handlePageChange(page)}>{page}</button>
                                            </li>
                                        ))}
                                        {/* Next */}
                                        <li className={`page-item ${safePage === totalPages ? 'disabled' : ''}`}>
                                            <button className="page-link rounded-3 me-1" onClick={() => handlePageChange(safePage + 1)} aria-label="Next">›</button>
                                        </li>
                                        {/* Last */}
                                        <li className={`page-item ${safePage === totalPages ? 'disabled' : ''}`}>
                                            <button className="page-link rounded-3" onClick={() => handlePageChange(totalPages)} aria-label="Last">»</button>
                                        </li>
                                    </ul>
                                </nav>
                            </div>
                        </>
                    ) : (
                        <div className="alert alert-info rounded-4 text-center">
                            <i className="bi bi-info-circle me-2" />No users found. <Link to="/admin/users/create">Add a new user</Link>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default UsersIndex;