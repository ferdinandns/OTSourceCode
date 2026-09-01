import { useParams, useNavigate } from "react-router-dom";
import { useProductDetail, useProductMutation } from "../../hooks/product/useProduct";
import { useState, useEffect } from "react";

export default function ProductEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useProductDetail(id!);
  const { update, remove } = useProductMutation();

  const [form, setForm] = useState({
    kategori_sampel: "",
    item_code: "",
    item_name: "",
    keterangan: "",
    lokasi_site: "",
  });

  useEffect(() => {
    if (data) {
      const responseData = data?.data || data;
      setForm({
        kategori_sampel: responseData.kategori_sampel || "",
        item_code: responseData.item_code || "",
        item_name: responseData.item_name || "",
        keterangan: responseData.keterangan || "",
        lokasi_site: responseData.lokasi_site || "",
      });
    }
  }, [data]);

  const submit = () => {
    const updateData = {
      kategori_sampel: form.kategori_sampel,
      item_code: form.item_code,
      item_name: form.item_name,
      keterangan: form.keterangan,
      lokasi_site: form.lokasi_site,
    };

    // Add this to see exactly what's being sent
    console.log("Sending update payload:", JSON.stringify(updateData, null, 2));

    update.mutate(
      { id: Number(id), data: updateData },
      {
        onSuccess: () => {
          alert("Product updated successfully!");
          navigate("/products");
        },
        onError: (error: any) => {
          // Log the FULL error response, not just message
          console.error("Full error response:", error?.response?.data);
          const errorMsg = error?.response?.data?.message
            || error?.response?.data?.error
            || error?.response?.data  // sometimes the body IS the message
            || error.message;
          alert("Failed to update: " + JSON.stringify(errorMsg));
        },
      }
    );
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      remove.mutate(Number(id), {
        onSuccess: () => {
          alert("Product deleted successfully!");
          navigate("/products");
        },
        onError: (error: any) => {
          alert("Failed to delete: " + (error?.response?.data?.message || error.message));
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mt-3 text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
        <p className="mt-3 text-muted">Loading product data...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container mt-3">
        <div className="alert alert-danger">
          <i className="bi bi-exclamation-triangle me-2"></i>
          Failed to load product data
        </div>
        <button className="btn btn-secondary" onClick={() => navigate("/products")}>
          Back to List
        </button>
      </div>
    );
  }

  const responseData = data?.data || data;

  return (
    <div className="container mt-3">
      <h3 className="text-center mb-4">Edit Product / Sample / Material</h3>

      {/* Item ID - READ ONLY */}
      <div className="mb-3">
        <label className="form-label">Item ID</label>
        <input
          className="form-control"
          value={responseData.item_id || ""}
          readOnly
          disabled
        />
      </div>

      {/* Category */}
      <div className="mb-3">
        <label htmlFor="kategori_sampel" className="form-label">
          Category *
        </label>
        <select
          id="kategori_sampel"
          className="form-select"
          value={form.kategori_sampel}
          onChange={(e) =>
            setForm({ ...form, kategori_sampel: e.target.value })
          }
        >
          <option value="">Select Category</option>
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

      {/* Item Code */}
      <div className="mb-3">
        <label htmlFor="item_code" className="form-label">
          Item Code (Oracle) *
        </label>
        <input
          id="item_code"
          className="form-control"
          value={form.item_code}
          onChange={(e) => setForm({ ...form, item_code: e.target.value })}
        />
      </div>

      {/* Item Name */}
      <div className="mb-3">
        <label htmlFor="item_name" className="form-label">
          Item Name *
        </label>
        <input
          id="item_name"
          className="form-control"
          value={form.item_name}
          onChange={(e) => setForm({ ...form, item_name: e.target.value })}
        />
      </div>

      {/* Description */}
      <div className="mb-3">
        <label htmlFor="keterangan" className="form-label">
          Description
        </label>
        <textarea
          id="keterangan"
          className="form-control"
          rows={3}
          value={form.keterangan}
          onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
        />
      </div>

      {/* Site Location */}
      <div className="mb-3">
        <label htmlFor="lokasi_site" className="form-label">
          Site Location *
        </label>
        <select
          id="lokasi_site"
          className="form-select"
          value={form.lokasi_site}
          onChange={(e) => setForm({ ...form, lokasi_site: e.target.value })}
        >
          <option value="">Select Site</option>
          <option value="PLG">PLG</option>
          <option value="CKR">CKR</option>
        </select>
      </div>

      {/* Buttons */}
      <div className="mt-4 d-flex justify-content-between">
        <button className="btn btn-danger" onClick={handleDelete}>
          <i className="bi bi-trash me-2"></i>
          Delete
        </button>
        <button className="btn btn-success" onClick={submit}>
          <i className="bi bi-check-circle me-2"></i>
          Save Changes
        </button>
      </div>
    </div>
  );
}