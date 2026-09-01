import { Link } from "react-router-dom";
import { useInstruments } from "../../hooks/instrument/useInstrument";
import SidebarMenu from "../../components/SidebarMenu";
import { useState, useMemo } from "react";
import { useAuth, GROUP_SUPERVISOR } from "../../context/AuthContext";

export default function InstrumentList() {
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(100);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { hasMinGroup } = useAuth();
    const isSupervisorPlus = hasMinGroup(GROUP_SUPERVISOR);
    const { data, isLoading, error } = useInstruments();

    const instruments = data?.data?.data || [];

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    // Filter instruments based on search query
    const filteredInstruments = useMemo(() => {
        let result = instruments;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = instruments.filter((ins: any) => {
                const getValue = (obj: any, ...keys: string[]) => {
                    for (const key of keys) {
                        if (obj[key] !== undefined && obj[key] !== null) {
                            return String(obj[key]).toLowerCase();
                        }
                    }
                    return "";
                };

                const nama = getValue(ins, 'NamaInstrument', 'nama_instrument', 'name', 'Nama');
                const nomorKontrol = getValue(ins, 'NomorKontrol', 'nomor_kontrol', 'instrument_code', 'KodeInstrument', 'control_number');
                const pic = getValue(ins, 'PICInstrument', 'pic_instrument', 'pic_name', 'PicName');
                const lokasi = getValue(ins, 'LokasiInstrument', 'lokasi_instrument', 'location_instrument', 'room');
                const status = getValue(ins, 'Status', 'status');
                const picSO = getValue(ins, 'PICStockOpname', 'pic_stock_opname', 'PicStockOpname');

                return (
                    nama.includes(query) ||
                    nomorKontrol.includes(query) ||
                    pic.includes(query) ||
                    lokasi.includes(query) ||
                    status.includes(query) ||
                    picSO.includes(query)
                );
            });
        }

        // Sort A-Z by nama instrument
        return [...result].sort((a: any, b: any) => {
            const getName = (obj: any) => {
                for (const key of ['NamaInstrument', 'nama_instrument', 'name', 'Nama']) {
                    if (obj[key] !== undefined && obj[key] !== null) return String(obj[key]);
                }
                return "";
            };
            return getName(a).localeCompare(getName(b), 'id');
        });

    }, [instruments, searchQuery]);

    // Pagination calculations (using filtered data)
    const totalItems = filteredInstruments.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredInstruments.slice(indexOfFirstItem, indexOfLastItem);

    // Reset to page 1 when search query changes
    const handleSearchChange = (value: string) => {
        setSearchQuery(value);
        setCurrentPage(1);
    };

    // Clear search
    const clearSearch = () => {
        setSearchQuery("");
        setCurrentPage(1);
    };

    // Pagination handlers
    const goToPage = (pageNumber: number) => {
        setCurrentPage(pageNumber);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const goToPrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages = [];
        const maxPagesToShow = 5;

        if (totalPages <= maxPagesToShow) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 4; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    const getExpiryDateColor = (expiryDate: string) => {
        if (!expiryDate) return "text-dark";

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expiry = new Date(expiryDate);
        if (isNaN(expiry.getTime())) {
            console.error("Invalid date:", expiryDate);
            return "text-dark";
        }
        expiry.setHours(0, 0, 0, 0);

        const diffTime = expiry.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 0) return "text-danger fw-bold";
        if (diffDays <= 21) return "text-warning fw-bold";
        if (diffDays >= 180) return "text-dark";
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return "-";

        return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
    };

    return (
        <div className="container-fluid mt-3">
            <div className="row">
                <div className="col-auto">
                    <SidebarMenu
                        isHorizontal={false}
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                    />
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="btn btn-link text-dark p-0"
                        style={{ fontSize: '1.75rem' }}
                    >
                        <i className="bi bi-list"></i>
                    </button>
                </div>

                <div className="col-md-11">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <h2 className="fw-bold mb-1">List Instrument</h2>
                        {isSupervisorPlus ? (
                            <Link className="btn btn-primary" to="create">
                                <i className="bi bi-plus-circle me-1"></i>
                                Add New Instrument
                            </Link>
                        ) : (
                            <div />
                        )

                        }

                    </div>

                    {error && (
                        <div className="alert alert-danger" role="alert">
                            Error loading instruments: {error instanceof Error ? error.message : 'Unknown error'}
                        </div>
                    )}

                    {isLoading ? (
                        <div className="text-center py-5">
                            <div className="spinner-border" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p className="mt-2 text-muted">Loading instruments...</p>
                        </div>
                    ) : (
                        <div className="card border-0 shadow-sm rounded-4 p-3">
                            {/* Search Bar */}
                            <div className="mb-3">
                                <div className="input-group">
                                    <span className="input-group-text bg-white">
                                        <i className="bi bi-search"></i>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control"
                                        placeholder="Search by name, control number, PIC, location, or status..."
                                        value={searchQuery}
                                        onChange={(e) => handleSearchChange(e.target.value)}
                                    />
                                    {searchQuery && (
                                        <button
                                            className="btn btn-outline-secondary"
                                            type="button"
                                            onClick={clearSearch}
                                            title="Clear search"
                                        >
                                            <i className="bi bi-x-circle"></i>
                                        </button>
                                    )}
                                </div>
                                {searchQuery && (
                                    <small className="text-muted">
                                        Found {totalItems} instrument{totalItems !== 1 ? 's' : ''} matching "{searchQuery}"
                                    </small>
                                )}
                            </div>

                            {/* Pagination Info & Items Per Page */}
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <div className="text-muted small">
                                    {totalItems > 0 ? (
                                        <>Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, totalItems)} of {totalItems} instruments</>
                                    ) : (
                                        <>No instruments found</>
                                    )}
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <label className="small mb-0">Items per page:</label>
                                    <select
                                        className="form-select form-select-sm"
                                        style={{ width: 'auto' }}
                                        value={itemsPerPage}
                                        onChange={(e) => {
                                            setItemsPerPage(Number(e.target.value));
                                            setCurrentPage(1);
                                        }}
                                    >
                                        <option value={5}>5</option>
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                </div>
                            </div>

                            <div className="table-responsive">
                                <table className="table table-bordered table-hover table-sm">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Nama Instrument</th>
                                            <th>Nomor Kontrol</th>
                                            <th>PIC</th>
                                            <th>Lokasi</th>
                                            <th>Tanggal Kalibrasi</th>
                                            <th>ED Kalibrasi</th>
                                            <th>Status</th>
                                            <th>Tanggal SO</th>
                                            <th>PIC SO</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentItems.length > 0 ? (
                                            currentItems.map((ins: any) => {
                                                const getValue = (obj: any, ...keys: string[]) => {
                                                    for (const key of keys) {
                                                        if (obj[key] !== undefined && obj[key] !== null) {
                                                            return obj[key];
                                                        }
                                                    }
                                                    return "-";
                                                };

                                                const id = ins.Id || ins.id || ins.ID;
                                                const nama = getValue(ins, 'NamaInstrument', 'nama_instrument', 'name', 'Nama');
                                                const nomorKontrol = getValue(ins, 'NomorKontrol', 'nomor_kontrol', 'instrument_code', 'KodeInstrument', 'control_number');
                                                const pic = getValue(ins, 'PICInstrument', 'pic_instrument', 'pic_name', 'PicName');
                                                const lokasi = getValue(ins, 'LokasiInstrument', 'lokasi_instrument', 'location_instrument', 'room');
                                                const tanggalKal = ins.TanggalKalibrasi || ins.tanggal_kalibrasi || ins.calibration_date;
                                                const edKal = ins.EDKalibrasi || ins.ed_kalibrasi || ins.calibration_expiry_date || ins.TenggatKalibrasi;
                                                const status = ins.Status || ins.status;
                                                const tanggalSO = ins.TanggalStockOpname || ins.tanggal_stock_opname || ins.stock_opname_date;
                                                const picSO = getValue(ins, 'PICStockOpname', 'pic_stock_opname', 'PicStockOpname');

                                                return (
                                                    <tr key={id}>
                                                        <td>{nama}</td>
                                                        <td><code>{nomorKontrol}</code></td>
                                                        <td>{pic}</td>
                                                        <td>{lokasi}</td>
                                                        <td>{formatDate(tanggalKal)}</td>
                                                        <td className={getExpiryDateColor(edKal)}>
                                                            {formatDate(edKal)}
                                                        </td>
                                                        <td>
                                                            <span
                                                                className={`badge ${status === "Available"
                                                                    ? "bg-success"
                                                                    : status === "Inactive" || status === "Unavailable"
                                                                        ? "bg-secondary"
                                                                        : status === "In Used"
                                                                            ? "bg-primary"
                                                                            : "bg-warning"
                                                                    }`}
                                                            >
                                                                {status || "-"}
                                                            </span>
                                                        </td>
                                                        <td>{formatDate(tanggalSO)}</td>
                                                        <td>{picSO}</td>
                                                        <td>
                                                            <div className="btn-group-vertical btn-group-sm" role="group">
                                                                <Link
                                                                    className="btn btn-sm btn-info text-white"
                                                                    to={`/instruments/${id}`}
                                                                    title="View Detail"
                                                                >
                                                                    <i className="bi bi-info-circle me-1"></i>
                                                                    View
                                                                </Link>
                                                                <Link
                                                                    className="btn btn-sm btn-warning"
                                                                    to={`edit/${id}`}
                                                                    title="Edit Instrument"
                                                                >
                                                                    <i className="bi bi-pencil me-1"></i>
                                                                    Edit
                                                                </Link>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={10} className="text-center text-muted py-4">
                                                    <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                                                    {searchQuery ? `No instruments found matching "${searchQuery}"` : 'Tidak ada data instrument'}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <nav className="mt-3">
                                    <ul className="pagination pagination-sm justify-content-center mb-0">
                                        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                                            <button
                                                className="page-link"
                                                onClick={goToPrevPage}
                                                disabled={currentPage === 1}
                                            >
                                                <i className="bi bi-chevron-left"></i>
                                            </button>
                                        </li>

                                        {getPageNumbers().map((page, index) => (
                                            page === '...' ? (
                                                <li key={`ellipsis-${index}`} className="page-item disabled">
                                                    <span className="page-link">...</span>
                                                </li>
                                            ) : (
                                                <li
                                                    key={page}
                                                    className={`page-item ${currentPage === page ? 'active' : ''}`}
                                                >
                                                    <button
                                                        className="page-link"
                                                        onClick={() => goToPage(Number(page))}
                                                    >
                                                        {page}
                                                    </button>
                                                </li>
                                            )
                                        ))}

                                        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                                            <button
                                                className="page-link"
                                                onClick={goToNextPage}
                                                disabled={currentPage === totalPages}
                                            >
                                                <i className="bi bi-chevron-right"></i>
                                            </button>
                                        </li>
                                    </ul>
                                </nav>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}