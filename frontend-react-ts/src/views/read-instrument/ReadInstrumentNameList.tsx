import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import api from "../../services/api";
import SidebarMenu from "../../components/SidebarMenu";
import { useState } from "react";

export default function ReadInstrumentNameList() {
    const { category } = useParams<{ category: string }>();

    // Fetch unique instrument names by category
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["instrument-names", category],
        queryFn: async () => {
            console.log("🔍 Fetching instrument names for category:", category);
            const response = await api.get(`/api/instruments/by-type/${category}/names`);
            console.log("📦 API Response:", response.data);
            return response.data;
        },
        enabled: !!category
    });

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const instrumentNames = data?.data || [];
    console.log("📋 Instrument names:", instrumentNames);

    const getCategoryInfo = (cat: string) => {
        if (cat === "equipment") {
            return {
                label: "Equipment (Simple Device)",
                description: "Alat kecil: Balance, pH Meter, Conductivity Meter, Oven, Incubator",
                icon: "bi-gear-fill",
                color: "primary"
            };
        }
        return {
            label: "Instrument",
            description: "Alat besar: HPLC, AAS, Spectrophotometer, Autoclave, Linomat",
            icon: "bi-cpu-fill",
            color: "success"
        };
    };

    const categoryInfo = getCategoryInfo(category || "");

    return (
        <div className="container mt-3 mb-1">
            <div className="row">
                {/* SIDEBAR */}
                <SidebarMenu
          isHorizontal={false}
          isSidebarOpen={isSidebarOpen}
          toggleSidebar={toggleSidebar}
        />
                {/* CONTENT */}
                <div className="col-md-12">
                    {/* Breadcrumb */}

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
                            <li className="breadcrumb-item active" aria-current="page">
                                Read {categoryInfo.label}
                            </li>
                        </ol>
                    </nav>

                    {/* Header */}
                    <div className="d-flex align-items-center mb-4">
                        <div className={`bg-${categoryInfo.color} bg-opacity-10 rounded-3 p-3 me-3`}>
                            <i className={`${categoryInfo.icon} fs-2 text-${categoryInfo.color}`}></i>
                        </div>
                        <div className="flex-grow-1">
                            <h3 className="mb-1">{categoryInfo.label}</h3>
                            <p className="text-muted mb-0">
                                Pilih nama instrument untuk melihat daftar nomor kontrol
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

                    {/* Error Alert */}
                    {error && (
                        <div className="alert alert-danger" role="alert">
                            <i className="bi bi-exclamation-triangle me-2"></i>
                            Error: {error instanceof Error ? error.message : 'Unknown error'}
                        </div>
                    )}

                    {/* Loading */}
                    {isLoading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="mt-2 text-muted">Loading instrument names...</p>
                        </div>
                    ) : (
                        <div className="card border-0 shadow-sm rounded-4">
                            <div className="card-body p-4">
                                {instrumentNames.length > 0 ? (
                                    <>
                                        <div className="mb-3 text-muted small">
                                            Menampilkan {instrumentNames.length} jenis instrument
                                        </div>
                                        <div className="row g-3">
                                            {instrumentNames.map((item: any) => {
                                                const nama = item.nama || item.Nama;
                                                const count = item.count || item.Count || 0;

                                                return (
                                                    <div key={nama} className="col-md-6 col-lg-4">
                                                        <Link
                                                            to={`/read-instrument/${category}/${encodeURIComponent(nama)}`}
                                                            className="text-decoration-none"
                                                        >
                                                            <div className="card h-100 border instrument-name-card">
                                                                <div className="card-body p-4">
                                                                    <div className="d-flex justify-content-between align-items-start mb-3">
                                                                        <h5 className="card-title mb-0 flex-grow-1">
                                                                            {nama}
                                                                        </h5>
                                                                        <span className={`badge bg-${categoryInfo.color}`}>
                                                                            {count} unit
                                                                        </span>
                                                                    </div>

                                                                    <div className="text-muted small mb-3">
                                                                        <i className="bi bi-list-ul me-1"></i>
                                                                        {count} Nomor Kontrol tersedia
                                                                    </div>

                                                                    <div className="text-end">
                                                                        <span className={`btn btn-sm btn-${categoryInfo.color}`}>
                                                                            Lihat Daftar
                                                                            <i className="bi bi-arrow-right ms-2"></i>
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </Link>
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
                                            Tidak ada {categoryInfo.label.toLowerCase()} yang tersedia
                                        </p>
                                        <button
                                            className="btn btn-outline-primary btn-sm"
                                            onClick={() => refetch()}
                                        >
                                            <i className="bi bi-arrow-clockwise me-1"></i>
                                            Coba Lagi
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .instrument-name-card {
                    transition: all 0.3s ease;
                    cursor: pointer;
                }
                .instrument-name-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 .5rem 1.5rem rgba(0,0,0,.2)!important;
                }
            `}</style>
        </div>
    );
}