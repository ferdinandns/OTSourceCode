import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import SidebarMenu from "../../components/SidebarMenu";
import { useState } from "react";
import { useAuth } from "../../context/AuthContext";

export default function ReadInstrumentCodeList() {
    const { category, nama } = useParams<{ category: string; nama: string }>();
    const { user } = useAuth();  // ← ambil user yang sedang login

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["instrument-codes", category, nama],
        queryFn: async () => {
            const response = await api.get(
                `/api/instruments/by-type/${category}/nama/${encodeURIComponent(nama || '')}`
            );
            console.log("📦 Raw API response:", JSON.stringify(response.data, null, 2)); // ← tambah ini
            return response.data;
        },
        enabled: !!category && !!nama
    });

    const instruments = data?.data || [];

    const getCategoryInfo = (cat: string) => {
        if (cat === "equipment") {
            return { label: "Equipment", icon: "bi-gear-fill", color: "primary" };
        }
        return { label: "Instrument", icon: "bi-cpu-fill", color: "success" };
    };

    const categoryInfo = getCategoryInfo(category || "");

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { class: string; text: string }> = {
            "Available": { class: "bg-success", text: "Available" },
            "In Used": { class: "bg-primary", text: "In Used" },
            "Unverified": { class: "bg-warning text-dark", text: "Unverified" },
            "Unavailable": { class: "bg-secondary", text: "Unavailable" },
            "Unconfigured": { class: "bg-info", text: "Unconfigured" },
            "Damaged": { class: "bg-danger", text: "Damaged" },
        };
        const statusInfo = statusMap[status] || { class: "bg-secondary", text: status };
        return <span className={`badge ${statusInfo.class}`}>{statusInfo.text}</span>;
    };

    const getActionButton = (instrument: any) => {
        const id = instrument.id || instrument.Id;
        const status = instrument.status || instrument.Status;
        const usageId = instrument.current_usage_id;
        const currentUserID = instrument.current_user_id;
        const currentUserName = instrument.current_user_name;
        const sharedAccess = instrument.shared_access;

        // ← kunci utama: apakah session ini milik user yang login?
        const isMySession = !!usageId && currentUserID === user?.id;
        const canResume = isMySession || (sharedAccess && !!usageId);

        if (status === "In Used" || status === "In Use") {
            console.log("🔍 In Used instrument:", {
                usageId,
                currentUserID,
                currentUserIDType: typeof currentUserID,
                userID: user?.id,
                userIDType: typeof user?.id,
                isMySession,
            });
        }

        if (status === "Available") {
            return (
                <Link
                    to={`/instruments/read/${id}`}
                    className="btn btn-success btn-sm w-100"
                >
                    <i className="bi bi-play-circle me-1"></i>
                    Start Read
                </Link>
            );
        }

        if (status === "Unverified") {
            return (
                <Link
                    to={`/verifications/start/${id}`}
                    className="btn btn-warning btn-sm w-100"
                >
                    <i className="bi bi-shield-check me-1"></i>
                    Verify First
                </Link>
            );
        }

        if (status === "Unconfigured") {
            return (
                <button className="btn btn-secondary btn-sm w-100" disabled>
                    <i className="bi bi-x-circle me-1"></i>
                    Need Configuration
                </button>
            );
        }

        if (status === "In Used" || status === "In Use") {
            const hasPendingReread = instrument.reread_batch_status &&
                Object.values(instrument.reread_batch_status).some(
                    (s: any) => s === "awaiting_approval" || s === "pending"
                );

            if (canResume) {
                return (
                    <Link
                        to={`/instruments/read/${id}?usage_id=${usageId}`}
                        className="btn btn-warning btn-sm w-100"
                        onClick={() => {
                            if (!isMySession && sharedAccess) {
                                api.post(`/api/instruments/usage/${usageId}/resume`).catch(() => { });
                            }
                        }}
                    >
                        <i className="bi bi-play-circle-fill me-1"></i>
                        {hasPendingReread ? "Pending Approval" : "Resume Reading"}
                    </Link>


                );
            }

            // User lain, bukan shared
            return (
                <button
                    className="btn btn-primary btn-sm w-100"
                    disabled
                    title={currentUserName ? `Sedang digunakan oleh ${currentUserName}` : ""}
                >
                    <i className="bi bi-hourglass-split me-1"></i>
                    In Use{currentUserName ? ` (${currentUserName})` : ""}
                </button>
            );
        }

        return (
            <button className="btn btn-secondary btn-sm w-100" disabled>
                <i className="bi bi-x-circle me-1"></i>
                Not Available
            </button>
        );
    };

    return (
        <div className="container mt-3">
            <div className="row">
                <SidebarMenu
                    isHorizontal={false}
                    isSidebarOpen={isSidebarOpen}
                    toggleSidebar={toggleSidebar}
                />

                <div className="col-md-12">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="btn btn-link text-dark p-0 me-3"
                        style={{ fontSize: '1.5rem' }}
                    >
                        <i className="bi bi-list"></i>
                    </button>

                    <nav aria-label="breadcrumb" className="mb-3">
                        <ol className="breadcrumb">
                            <li className="breadcrumb-item">
                                <Link to="/admin/dashboard">Home</Link>
                            </li>
                            <li className="breadcrumb-item">
                                <Link to={`/read-instrument/${category}`}>
                                    {categoryInfo.label}
                                </Link>
                            </li>
                            <li className="breadcrumb-item active" aria-current="page">
                                {nama}
                            </li>
                        </ol>
                    </nav>

                    <div className="d-flex align-items-center mb-4">
                        <div className={`bg-${categoryInfo.color} bg-opacity-10 rounded-3 p-3 me-3`}>
                            <i className={`${categoryInfo.icon} fs-2 text-${categoryInfo.color}`}></i>
                        </div>
                        <div className="flex-grow-1">
                            <h3 className="mb-1">{nama}</h3>
                            <p className="text-muted mb-0">
                                Pilih nomor kontrol untuk memulai pembacaan data
                            </p>
                        </div>
                        <button
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => refetch()}
                        >
                            <i className="bi bi-arrow-clockwise me-1"></i>
                            Refresh
                        </button>
                    </div>

                    {error && (
                        <div className="alert alert-danger" role="alert">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            Error: {error instanceof Error ? error.message : 'Unknown error'}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="mt-2 text-muted">Loading instruments...</p>
                        </div>
                    ) : (
                        <div className="card border-0 shadow-sm rounded-4">
                            <div className="card-body p-4">
                                {instruments.length > 0 ? (
                                    <>
                                        <div className="mb-3 text-muted small">
                                            Menampilkan {instruments.length} unit
                                        </div>
                                        <div className="row g-3">
                                            {instruments.map((instrument: any) => {
                                                const id = instrument.id || instrument.Id;
                                                const code = instrument.kode_instrument || instrument.KodeInstrument;
                                                const location = instrument.lokasi_instrument || instrument.LokasiInstrument;
                                                const pic = instrument.pic_instrument || instrument.PICInstrument;
                                                const status = instrument.status || instrument.Status;

                                                return (
                                                    <div key={id} className="col-md-6">
                                                        <div className="card h-100 border instrument-card">
                                                            <div className="card-body">
                                                                <div className="d-flex justify-content-between align-items-start mb-3">
                                                                    <div className="flex-grow-1">
                                                                        <h5 className="card-title mb-1">
                                                                            <code className="text-primary fs-6">
                                                                                {code}
                                                                            </code>
                                                                        </h5>
                                                                        <small className="text-muted">{nama}</small>
                                                                    </div>
                                                                    {getStatusBadge(status)}
                                                                </div>

                                                                <div className="mb-3">
                                                                    <div className="small text-muted">
                                                                        <i className="bi bi-geo-alt me-1"></i>
                                                                        {location}
                                                                    </div>
                                                                    <div className="small text-muted">
                                                                        <i className="bi bi-person me-1"></i>
                                                                        PIC: {pic || '-'}
                                                                    </div>
                                                                </div>

                                                                {getActionButton(instrument)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center py-5">
                                        <i className="bi bi-inbox fs-1 text-muted d-block mb-3"></i>
                                        <h5 className="text-muted">Tidak ada instrument</h5>
                                        <p className="text-muted mb-3">
                                            Tidak ada unit yang tersedia untuk {nama}
                                        </p>
                                        <Link
                                            to={`/read-instrument/${category}`}
                                            className="btn btn-outline-primary btn-sm"
                                        >
                                            <i className="bi bi-arrow-left me-1"></i>
                                            Kembali
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .instrument-card {
                    transition: all 0.3s ease;
                }
                .instrument-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 .5rem 1rem rgba(0,0,0,.15)!important;
                }
            `}</style>
        </div>
    );
}