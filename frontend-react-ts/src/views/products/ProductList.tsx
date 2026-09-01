import { Link } from "react-router-dom";
import { useProductMutation, useProducts } from "../../hooks/product/useProduct";
import SidebarMenu from "../../components/SidebarMenu";
import { useState } from "react";
import ImportProductModal from "../../components/ImportProductModal";

export default function ProductList() {
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  const { remove } = useProductMutation();
  const userGroup = 3;
  const [showImport, setShowImport] = useState(false);
  const { data, isLoading, error } = useProducts({
    search: searchTerm,
    kategori_sampel: categoryFilter,
    page: currentPage,
    limit,
  });

  const products = data?.data?.data || [];
  const total = data?.data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // reset to page 1 on new search
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategoryFilter(e.target.value);
    setCurrentPage(1); // reset to page 1 on filter change
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, "0")}/${String(
      date.getMonth() + 1
    ).padStart(2, "0")}/${date.getFullYear()}`;
  };

  const getCategoryBadgeColor = (category: string) => {
    const colorMap: { [key: string]: string } = {
      RM: "bg-primary",
      PM: "bg-success",
      RUAH: "bg-info",
      FINISHED_GOOD: "bg-warning",
      STABTEST: "bg-danger",
      MIKRO: "bg-secondary",
      PROSES: "bg-dark",
      WS: "bg-primary",
      LAINNYA: "bg-secondary",
      EHM: "bg-info",
    };
    return colorMap[category] || "bg-secondary";
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      remove.mutate(id, {
        onSuccess: () => {
          alert("Product deleted successfully!");
        },
        onError: (error: any) => {
          alert("Failed to delete: " + (error?.response?.data?.message || error.message));
        },
      });
    }
  };




  return (
    <div className="container-fluid mt-3">
      <div className="row">
        {/* Sidebar */}
        <div className="col-auto">
          <SidebarMenu
            isHorizontal={false}
            isSidebarOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          />
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="btn btn-link text-dark p-0"
            style={{ fontSize: "1.75rem" }}
          >
            <i className="bi bi-list"></i>
          </button>
        </div>

        {/* Main Content */}
        <div className="col-md-11">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="fw-bold mb-1">List Products & Material</h2>
            <div className="d-flex gap-2">
              {userGroup <= 3 && (
                <button className="btn btn-outline-success" onClick={() => setShowImport(true)}>
                  <i className="bi bi-file-earmark-arrow-up me-2"></i>
                  Import
                </button>
              )}
              <Link className="btn btn-primary" to="create">
                <i className="bi bi-plus-circle me-2"></i>
                Add New
              </Link>
            </div>
            {/* Add the modal at the bottom of the return, before the closing </div> */}
            <ImportProductModal
              show={showImport}
              onClose={() => setShowImport(false)}
            />
          </div>

          {/* Filters */}
          <div className="card mb-3 shadow-sm">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-6">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search by Item Code, Name..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </div>
                <div className="col-md-4">
                  <select
                    className="form-select"
                    value={categoryFilter}
                    onChange={handleCategoryChange}
                  >
                    <option value="">All Categories</option>
                    <option value="RM">RM (Raw Material)</option>
                    <option value="PM">PM (Packaging Material)</option>
                    <option value="RUAH">Ruah</option>
                    <option value="FINISHED_GOOD">Finished Good</option>
                    <option value="STABTEST">Stabtest</option>
                    <option value="MIKRO">Mikro</option>
                    <option value="PROSES">Proses</option>
                    <option value="WS">WS</option>
                    <option value="LAINNYA">Lainnya</option>
                    <option value="EHM">EHM</option>
                  </select>
                </div>
                <div className="col-md-2">
                  <button
                    className="btn btn-secondary w-100"
                    onClick={() => {
                      setSearchTerm("");
                      setCategoryFilter("");
                      setCurrentPage(1);
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger">
              Error loading products:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border" role="status" />
              <p className="mt-2 text-muted">Loading products...</p>
            </div>
          ) : (
            <div className="card border-0 shadow-sm rounded-4 p-3">
              <div className="mb-3 text-muted small">
                Showing {products.length} of {total} products
              </div>

              <div className="table-responsive">
                <table className="table table-bordered table-hover table-sm">
                  <thead className="table-light">
                    <tr>
                      <th>Item ID</th>
                      <th>Category</th>
                      <th>Item Code</th>
                      <th>Item Name</th>
                      <th>Site</th>
                      <th>Created Date</th>
                      <th>Created By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.length > 0 ? (
                      products.map((product: any) => (
                        <tr key={product.id}>
                          <td><code>{product.item_id}</code></td>
                          <td>
                            <span className={`badge ${getCategoryBadgeColor(product.kategori_sampel)}`}>
                              {product.kategori_sampel}
                            </span>
                          </td>
                          <td>{product.item_code}</td>
                          <td>{product.item_name}</td>
                          <td>
                            <span className="badge bg-info">{product.lokasi_site}</span>
                          </td>
                          <td>{formatDate(product.created_at)}</td>
                          <td>{product.created_by}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <Link
                                className="btn btn-sm btn-warning"
                                to={`edit/${product.id}`}
                                title="Edit"
                              >
                                <i className="bi bi-pencil"></i> Edit
                              </Link>
                              <button
                                className="btn btn-sm btn-danger"
                                title="Delete"
                                onClick={() => handleDelete(product.id)}
                                disabled={remove.isPending}
                              >
                                <i className="bi bi-trash"></i> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={8} className="text-center text-muted py-4">
                          <i className="bi bi-inbox fs-1 d-block mb-2"></i>
                          No products found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <small className="text-muted">
                    Page {currentPage} of {totalPages}
                  </small>
                  <nav>
                    <ul className="pagination pagination-sm mb-0">
                      <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                        <button className="page-link" onClick={() => setCurrentPage(1)}>
                          «
                        </button>
                      </li>
                      <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                        <button className="page-link" onClick={() => setCurrentPage((p) => p - 1)}>
                          ‹
                        </button>
                      </li>

                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                        .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, idx) =>
                          p === "..." ? (
                            <li key={`ellipsis-${idx}`} className="page-item disabled">
                              <span className="page-link">…</span>
                            </li>
                          ) : (
                            <li key={p} className={`page-item ${currentPage === p ? "active" : ""}`}>
                              <button className="page-link" onClick={() => setCurrentPage(p as number)}>
                                {p}
                              </button>
                            </li>
                          )
                        )}

                      <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                        <button className="page-link" onClick={() => setCurrentPage((p) => p + 1)}>
                          ›
                        </button>
                      </li>
                      <li className={`page-item ${currentPage === totalPages ? "disabled" : ""}`}>
                        <button className="page-link" onClick={() => setCurrentPage(totalPages)}>
                          »
                        </button>
                      </li>
                    </ul>
                  </nav>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}