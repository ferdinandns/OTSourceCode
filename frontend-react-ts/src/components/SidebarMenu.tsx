import { FC, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLogout } from "../hooks/auth/useLogout";
import { useAuth, GROUP_MANAGER, GROUP_SUPERVISOR, GROUP_ANALYST } from "../context/AuthContext";

interface SidebarMenuProps {
    isHorizontal?: boolean;
    isSidebarOpen?: boolean;
    toggleSidebar?: () => void;
}

const SidebarMenu: FC<SidebarMenuProps> = ({
    isHorizontal = false,
    isSidebarOpen = true,
    toggleSidebar,
}) => {
    const logout = useLogout();
    const location = useLocation();
    const { user, hasMinGroup } = useAuth();

    const [isReadInstrumentOpen, setIsReadInstrumentOpen] = useState(
        location.pathname.startsWith("/read-instrument")
    );

    // ── Permission shorthands ────────────────────────────────────────────────
    const isManagerPlus = hasMinGroup(GROUP_MANAGER);    // group 1–2
    const isSupervisorPlus = hasMinGroup(GROUP_SUPERVISOR); // group 1–3
    const isAnalystPlus = hasMinGroup(GROUP_ANALYST); // group 1–4

    // ── Active link style helper ─────────────────────────────────────────────
    const activeStyle = (path: string, exact = false): React.CSSProperties => {
        const isActive = exact
            ? location.pathname === path
            : location.pathname.startsWith(path);
        return {
            color: isActive ? "#2196F3" : "#333",
            fontWeight: isActive ? "600" : "400",
            borderBottom: isActive ? "3px solid #2196F3" : "none",
            transition: "all 0.3s",
            fontSize: "0.9rem",
            whiteSpace: "nowrap",
        };
    };

    // ── Horizontal (top nav) ─────────────────────────────────────────────────
    if (isHorizontal) {
        return (
            <div
                className="shadow-sm"
                style={{
                    background: "rgba(210, 240, 211, 0.8)",
                    borderBottom: "1px solid #e0e0e0",
                }}
            >
                <div className="container-fluid px-2">
                    <div
                        className="d-flex align-items-center justify-content-center flex-wrap"
                        style={{ gap: "1.5rem" }}
                    >
                        {/* Dashboard — all authenticated */}
                        <Link
                            to="/admin/dashboard"
                            className="nav-link px-2 py-2 d-inline-flex align-items-center"
                            style={activeStyle("/admin/dashboard", true)}
                        >
                            <i className="bi bi-speedometer2 me-1" style={{ fontSize: "0.85rem" }} />
                            Dashboard
                        </Link>

                        {/* Instrument — all authenticated */}
                        <div className="dropdown">
                            <button
                                className="btn btn-link nav-link dropdown-toggle px-2 py-2"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                                style={{ color: "#333", fontSize: "0.9rem", textDecoration: "none", whiteSpace: "nowrap" }}
                            >
                                <i className="bi bi-tools me-1" style={{ fontSize: "0.85rem" }} />
                                Instrument
                            </button>
                            <ul className="dropdown-menu shadow-sm">
                                <li>
                                    <Link
                                        to="/read-instrument/equipment"
                                        className={`dropdown-item ${location.pathname.startsWith("/read-instrument") ? "active" : ""}`}
                                    >
                                        <i className="bi bi-play-circle me-2" />
                                        Read Instrument
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        to="/verifications"
                                        className={`dropdown-item ${location.pathname === "/verifications" ? "active" : ""}`}
                                    >
                                        <i className="bi bi-shield-check me-2" />
                                        Verify Instrument
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        to="/instruments"
                                        className={`dropdown-item ${location.pathname === "/instruments" ? "active" : ""}`}
                                    >
                                        <i className="bi bi-list-ul me-2" />
                                        View Instrument
                                    </Link>
                                </li>

                                {/* Pending approvals: supervisor+ */}
                                {isSupervisorPlus && (
                                    <li>
                                        <Link
                                            to="/instruments/pending-approvals"
                                            className={`dropdown-item ${location.pathname === "/instruments/pending-approvals" ? "active" : ""}`}
                                        >
                                            <i className="bi bi-hourglass-split me-2" />
                                            Pending Approvals
                                        </Link>
                                    </li>
                                )}
                            </ul>
                        </div>


                        {/* Products — all authenticated */
                            isSupervisorPlus && (

                                <Link
                                    to="/products"
                                    className="nav-link px-2 py-2 d-inline-flex align-items-center"
                                    style={activeStyle("/products", true)}
                                >
                                    <i className="bi bi-box-seam me-1" style={{ fontSize: "0.85rem" }} />
                                    View Product
                                </Link>
                            )}


                        {/* User management — manager+ only */}
                        {isSupervisorPlus && (
                            <Link
                                to="/admin/users"
                                className="nav-link px-2 py-2 d-inline-flex align-items-center"
                                style={activeStyle("/admin/users", true)}
                            >
                                <i className="bi bi-people me-1" style={{ fontSize: "0.85rem" }} />
                                View Users
                            </Link>
                        )}

                        {/* Checklist / Initial Condition — manager+ only */}
                        {isSupervisorPlus && (
                            <Link
                                to="/admin/checklist"
                                className="nav-link px-2 py-2 d-inline-flex align-items-center"
                                style={activeStyle("/admin/checklist", true)}
                            >
                                <i className="bi bi-list-check me-1" style={{ fontSize: "0.85rem" }} />
                                Initial Condition
                            </Link>
                        )}

                        {/* Bridge PC — manager+ only */}
                        {isAnalystPlus && (
                            <Link
                                to="/bridge/pcs"
                                className="nav-link px-2 py-2 d-inline-flex align-items-center"
                                style={activeStyle("/bridge/pcs", true)}
                            >
                                <i className="bi bi-hdd-network me-1" style={{ fontSize: "0.85rem" }} />
                                Bridge PC
                            </Link>

                        )}

                        {isAnalystPlus && (
                            <Link
                                to="/audit"
                                className="nav-link px-2 py-2 d-inline-flex align-items-center"
                                style={activeStyle("/audit", true)}
                            >
                                <i className="bi bi-journal-text me-1" style={{ fontSize: "0.85rem" }} />
                                Audit Trails
                            </Link>

                        )}

                        {/* Logout */}
                        <a
                            onClick={() => { logout(); toggleSidebar?.(); }}
                            className="nav-link px-2 py-2 d-inline-flex align-items-center"
                            style={{ cursor: "pointer" }}
                        >
                            <i className="bi bi-box-arrow-right me-2" />
                            Logout
                        </a>

                        {/* After — <Link> navigates to /profile on click */}
                        {user && (
                            <Link
                                to="/profile"
                                className="nav-link px-2 py-1 d-inline-flex align-items-center"
                                style={{
                                    fontSize: "0.8rem",
                                    color: "#555",
                                    border: "1px solid #ccc",
                                    borderRadius: "20px",
                                    background: "#fff",
                                    textDecoration: "none",
                                }}
                            >
                                <i className="bi bi-person-circle me-1" />
                                {user.name}
                                <span
                                    className="badge ms-2"
                                    style={{
                                        background: groupBadgeColor(user.user_group),
                                        fontSize: "0.65rem",
                                    }}
                                >
                                    {groupLabel(user.user_group)}
                                </span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Sidebar (mobile drawer) ───────────────────────────────────────────────
    return (
        <>
            {/* Backdrop */}
            {isSidebarOpen && (
                <div
                    className="position-fixed top-0 start-0 w-100 h-100"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1040 }}
                    onClick={toggleSidebar}
                />
            )}

            <div
                className="position-fixed top-0 start-0 h-100 bg-white shadow-lg"
                style={{
                    width: "280px",
                    zIndex: 1050,
                    transform: isSidebarOpen ? "translateX(0)" : "translateX(-100%)",
                    transition: "transform 0.3s ease-in-out",
                    overflowY: "auto",
                }}
            >
                {/* Header */}
                <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                    <div>
                        <h5 className="mb-0 fw-bold">MAIN MENU</h5>
                        {user && (
                            <small className="text-muted">
                                {user.name} ·{" "}
                                <span style={{ color: groupBadgeColor(user.user_group) }}>
                                    {groupLabel(user.user_group)}
                                </span>
                            </small>
                        )}
                    </div>
                    <button
                        className="btn btn-link text-dark p-0"
                        onClick={toggleSidebar}
                        style={{ fontSize: "1.5rem" }}
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                </div>

                <div className="p-2">
                    <div className="list-group list-group-flush">
                        {/* Dashboard */}
                        <Link
                            to="/admin/dashboard"
                            className="list-group-item list-group-item-action border-0 rounded mb-1"
                            onClick={toggleSidebar}
                        >
                            <i className="bi bi-speedometer2 me-2" />
                            Dashboard
                        </Link>

                        {/* Instruments */}
                        <Link
                            to="/instruments"
                            className="list-group-item list-group-item-action border-0 rounded mb-1"
                            onClick={toggleSidebar}
                        >
                            <i className="bi bi-list-ul me-2" />
                            Instruments
                        </Link>

                        {/* Read Instrument with submenu */}
                        <div className="mb-1">
                            <button
                                className="btn btn-link text-dark text-decoration-none text-start w-100 list-group-item list-group-item-action border-0 rounded d-flex justify-content-between align-items-center"
                                onClick={() => setIsReadInstrumentOpen((p) => !p)}
                            >
                                <span>
                                    <i className="bi bi-play-circle me-2" />
                                    Read Instrument
                                </span>
                                <i className={`bi bi-chevron-${isReadInstrumentOpen ? "down" : "right"}`} />
                            </button>
                            <div
                                style={{
                                    maxHeight: isReadInstrumentOpen ? "200px" : "0",
                                    overflow: "hidden",
                                    transition: "max-height 0.3s ease",
                                    backgroundColor: "#f8f9fa",
                                    borderRadius: "8px",
                                }}
                            >
                                <Link
                                    to="/read-instrument/equipment"
                                    className="list-group-item list-group-item-action border-0"
                                    style={{ paddingLeft: "2.5rem", fontSize: "0.9rem" }}
                                    onClick={toggleSidebar}
                                >
                                    Equipment (Simple Device)
                                </Link>
                                <Link
                                    to="/read-instrument/instrument"
                                    className="list-group-item list-group-item-action border-0"
                                    style={{ paddingLeft: "2.5rem", fontSize: "0.9rem" }}
                                    onClick={toggleSidebar}
                                >
                                    Instrument
                                </Link>
                            </div>
                        </div>

                        {/* Verification */}
                        <Link
                            to="/verifications"
                            className="list-group-item list-group-item-action border-0 rounded mb-1"
                            onClick={toggleSidebar}
                        >
                            <i className="bi bi-shield-check me-2" />
                            Instrument Verification
                        </Link>

                        {/* Products */}
                        {isSupervisorPlus && (
                            <Link
                                to="/products"
                                className="list-group-item list-group-item-action border-0 rounded mb-1"
                                onClick={toggleSidebar}
                            >
                                <i className="bi bi-box-seam me-2" />
                                Products & Material
                            </Link>
                        )}

                        {/* Pending Approvals — supervisor+ */}
                        {isSupervisorPlus && (
                            <Link
                                to="/instruments/pending-approvals"
                                className="list-group-item list-group-item-action border-0 rounded mb-1"
                                onClick={toggleSidebar}
                            >
                                <i className="bi bi-hourglass-split me-2" />
                                Pending Approvals
                            </Link>
                        )}

                        {/* User management — manager+ */}
                        {isSupervisorPlus && (
                            <Link
                                to="/admin/users"
                                className="list-group-item list-group-item-action border-0 rounded mb-1"
                                onClick={toggleSidebar}
                            >
                                <i className="bi bi-people me-2" />
                                Users
                            </Link>
                        )}

                        {/* Checklist — manager+ */}
                        {isManagerPlus && (
                            <Link
                                to="/admin/checklist"
                                className="list-group-item list-group-item-action border-0 rounded mb-1"
                                onClick={toggleSidebar}
                            >
                                <i className="bi bi-list-check me-2" />
                                Instrument Condition Management
                            </Link>
                        )}

                        {/* Bridge PC  */}
                        {isAnalystPlus && (
                            <Link
                                to="/bridge/pcs"
                                className="list-group-item list-group-item-action border-0 rounded mb-1"
                                onClick={toggleSidebar}
                            >
                                <i className="bi bi-hdd-network me-2" />
                                Bridge PC Management
                            </Link>
                        )}

                        {isAnalystPlus && (
                            <Link
                                to="/audit"
                                className="list-group-item list-group-item-action border-0 rounded mb-1"
                                onClick={toggleSidebar}
                            >
                                <i className="bi bi-box-seam me-2" />
                                Audit Trails
                            </Link>)}


                        {/* Logout */}
                        <a
                            onClick={() => { logout(); toggleSidebar?.(); }}
                            className="list-group-item list-group-item-action border-0 rounded mb-1"
                            style={{ cursor: "pointer" }}
                        >
                            <i className="bi bi-box-arrow-right me-2" />
                            Logout
                        </a>
                    </div>
                </div>

                <style>{`
          .list-group-item-action:hover { background-color: #f8f9fa; }
        `}</style>
            </div>
        </>
    );
};

// ── Badge helpers ────────────────────────────────────────────────────────────

function groupLabel(group: number): string {
    switch (group) {
        case 1: return "Superadmin";
        case 2: return "Manager";
        case 3: return "Supervisor";
        case 4: return "Analyst";
        case 5: return "User";
        default: return "Unknown";
    }
}

function groupBadgeColor(group: number): string {
    switch (group) {
        case 1: return "#d32f2f"; // red
        case 2: return "#1565c0"; // blue
        case 3: return "#2e7d32"; // green
        case 4: return "#e65100"; // orange
        case 5: return "#555";    // grey
        default: return "#999";
    }
}

export default SidebarMenu;