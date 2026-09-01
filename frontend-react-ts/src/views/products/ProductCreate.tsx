import { useState } from "react";
import { useProductMutation } from "../../hooks/product/useProduct";
import { useNavigate } from "react-router-dom";

export default function ProductCreate() {
  const navigate = useNavigate();
  const { create } = useProductMutation();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    kategori_sampel: "",
    item_code: "",
    item_name: "",
    keterangan: "",
    lokasi_site: "",
  });

  const isFormValid = () =>
    form.kategori_sampel &&
    form.item_code &&
    form.item_name &&
    form.lokasi_site;

  const submit = () => {
    if (!isFormValid()) {
      alert("Please fill in all required fields!");
      return;
    }

    setErrors({});

    create.mutate(
      {
        kategori_sampel: form.kategori_sampel,
        item_code: form.item_code,
        item_name: form.item_name,
        keterangan: form.keterangan,
        lokasi_site: form.lokasi_site,
      },
      {
        onSuccess: () => {
          alert("Product created successfully!");
          navigate("/products");
        },
        onError: (error: any) => {
          const response = error.response?.data;

          if (response?.details?.includes("item code")) {
            setErrors({ item_code: response.details });
            return;
          }

          if (Array.isArray(response?.details)) {
            const fieldErrors: Record<string, string> = {};
            response.details.forEach((d: any) => {
              fieldErrors[d.field] = d.message;
            });
            setErrors(fieldErrors);
            return;
          }

          setErrors({ general: response?.message ?? "Failed to create product" });
        },
      }
    );
  };

  return (
    <div className="container mt-4" >
      {/* Header */}
      <div className="mb-4">
        <button
          className="btn btn-outline-secondary btn-sm mb-3"
          onClick={() => navigate("/products")}
        >
          ← Back
        </button>
        <h4 className="fw-bold mb-1">Add New Product / Sample / Material</h4>
        <p className="text-muted small mb-0">
          Fill in the details below to register a new item
        </p>
      </div>

      {/* General Error Banner */}
      {errors.general && (
        <div className="alert alert-danger py-2 px-3 mb-4">
          ⚠️ {errors.general}
        </div>
      )}

      <div className="card shadow-sm border-0">
        <div className="card-body p-4">

          {/* Category */}
          <div className="mb-3">
            <label className="form-label fw-semibold small">
              Category <span className="text-danger">*</span>
            </label>
            <select
              className="form-select form-select-sm"
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
            <small className="text-muted">Select the category of the item</small>
          </div>

          {/* Item Code */}
          <div className="mb-3">
            <label className="form-label fw-semibold small">
              Item Code (Oracle) <span className="text-danger">*</span>
            </label>
            <input
              className={`form-control form-control-sm ${errors.item_code ? "is-invalid" : ""}`}
              placeholder="Enter item code from Oracle"
              value={form.item_code}
              onChange={(e) => {
                setForm({ ...form, item_code: e.target.value });
                setErrors((prev) => ({ ...prev, item_code: "" }));
              }}
            />
            {errors.item_code ? (
              <div className="invalid-feedback">⚠️ {errors.item_code}</div>
            ) : (
              <small className="text-muted">Item code as registered in Oracle system</small>
            )}
          </div>

          {/* Item Name */}
          <div className="mb-3">
            <label className="form-label fw-semibold small">
              Item Name <span className="text-danger">*</span>
            </label>
            <input
              className="form-control form-control-sm"
              placeholder="Enter item name"
              value={form.item_name}
              onChange={(e) => setForm({ ...form, item_name: e.target.value })}
            />
            <small className="text-muted">Full name of the product/sample/material</small>
          </div>

          {/* Description */}
          <div className="mb-3">
            <label className="form-label fw-semibold small">
              Description{" "}
              <span className="text-muted fw-normal">(Optional)</span>
            </label>
            <textarea
              className="form-control form-control-sm"
              rows={3}
              placeholder="Enter additional details or notes"
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            />
          </div>

          {/* Site Location */}
          <div className="mb-1">
            <label className="form-label fw-semibold small">
              Site Location <span className="text-danger">*</span>
            </label>
            <select
              className="form-select form-select-sm"
              value={form.lokasi_site}
              onChange={(e) =>
                setForm({ ...form, lokasi_site: e.target.value })
              }
            >
              <option value="">Select Site</option>
              <option value="PLG">PLG</option>
              <option value="CKR">CKR</option>
            </select>
            <small className="text-muted">Select the site location for this item</small>
          </div>

        </div>

        {/* Footer */}
        <div className="card-footer bg-light border-0 p-3">
          <div className="d-flex justify-content-between align-items-center">
            <small className="text-muted">
              <span className="text-danger">*</span> indicates required fields
            </small>
            <div className="d-flex gap-2">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={() => navigate("/products")}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm px-4"
                onClick={submit}
                disabled={!isFormValid() || create.isPending}
              >
                {create.isPending ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check-circle me-2"></i>
                    Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}