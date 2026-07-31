'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, API_BASE } from '@/lib/api';

interface MasterData {
  id: number;
  name: string;
  pic_dept_name?: string;
  is_apar: boolean;
}

type ActiveTab   = 'manual' | 'excel';
type ImportPhase = 'upload' | 'validate';

interface BulkParseRow {
  row:                number;
  sarpras_type_code:  string;
  location_dept_code: string;
  site_code:          string;
  location_detail:    string;
  is_critical:        boolean;
  has_alternative:    boolean;
  has_risk_location:  boolean;
  expired_date:       string;
  risk_score:         number;
  risk_level:         'low' | 'medium' | 'high' | 'very_high';
  valid:              boolean;
  errors:             string[];
}

interface BulkParseResponse {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  all_valid:  boolean;
  rows:       BulkParseRow[];
}

const RISK_STYLE = {
  low:       { bg: 'bg-[#65a30d]', text: 'text-white',    label: 'Low'       },
  medium:    { bg: 'bg-[#facc15]', text: 'text-gray-900', label: 'Medium'    },
  high:      { bg: 'bg-[#ef4444]', text: 'text-white',    label: 'High'      },
  very_high: { bg: 'bg-[#171717]', text: 'text-white',    label: 'Very High' },
} as const;

const RISK_BADGE = {
  low:       'bg-green-100 text-green-700',
  medium:    'bg-yellow-100 text-yellow-800',
  high:      'bg-red-100 text-red-700',
  very_high: 'bg-gray-900 text-white',
} as const;

// Only allow letters, numbers, spaces, and basic punctuation — no symbols like @, ', ", `, #, $, etc.
const ALLOWED_TEXT_REGEX = /^[a-zA-Z0-9\s.,\-/()?:!]*$/;
const sanitizeText = (value: string) =>
  value.replace(/[^a-zA-Z0-9\s.,\-/()?:!]/g, '');

function SuccessModal({
  open, title, desc, onClose,
}: {
  open: boolean; title: string; desc: string; onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        <div className="h-1.5 w-full bg-gradient-to-r from-[#003d7a] to-[#0062c4]" />
        <div className="px-6 sm:px-8 pt-8 sm:pt-10 pb-6 sm:pb-8 flex flex-col items-center text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-green-50 flex items-center justify-center mb-4 sm:mb-5">
            <svg className="w-7 h-7 sm:w-8 sm:h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-6 sm:mb-8">{desc}</p>
          <div className="flex flex-col-reverse sm:flex-row gap-3 w-full">
            <button
              onClick={() => (window.location.href = '/dashboard/list-sarpras')}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
              Lihat Daftar Sarpras
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-[#003d7a] text-white rounded-lg text-sm font-bold hover:bg-[#002d5a] transition-all"
            >
              Tambah Lagi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AddSarprasPage() {
  const router = useRouter();
  const [tab, setTab] = useState<ActiveTab>('manual');

  return (
    <div className="min-h-screen bg-[#f4f7f9] py-6 sm:py-10 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto">

        <div className="mb-6 sm:mb-8 flex items-center relative cursor-pointer">
          <button
            onClick={() => {
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push('/dashboard/list-sarpras');
              }
            }}
            aria-label="Kembali"
            className="absolute left-0 bg-white border border-gray-200 shadow-sm p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-all text-gray-700"
          >
            <ArrowLeftIcon />
          </button>
          <h2 className="text-lg sm:text-[22px] lg:text-[28px] font-bold text-gray-900 w-full text-center tracking-tight px-14">
            Tambah Sarana Prasarana Emergency
          </h2>
        </div>

        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-4 sm:mb-6 w-full sm:w-fit shadow-sm">
          <TabBtn
            active={tab === 'manual'}
            onClick={() => setTab('manual')}
            icon={<PencilIcon />}
            label="Input Manual"
          />
          <TabBtn
            active={tab === 'excel'}
            onClick={() => setTab('excel')}
            icon={<TableIcon />}
            label="Upload via Excel"
          />
        </div>

        {tab === 'manual' ? <ManualForm router={router} /> : <ExcelImport />}
      </div>
    </div>
  );
}

function TabBtn({
  active, onClick, icon, label, badge,
}: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; label: string; badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-5 py-2.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${
        active
          ? 'bg-[#003d7a] text-white shadow-md'
          : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
      {badge && (
        <span className={`hidden sm:inline text-[10px] font-bold px-2 py-0.5 rounded-full ${
          active ? 'bg-white/20 text-white' : 'bg-[#003d7a]/10 text-[#003d7a]'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function ManualForm({ router }: { router: ReturnType<typeof useRouter> }) {
  const [departments,  setDepartments]  = useState<MasterData[]>([]);
  const [sarprasTypes, setSarprasTypes] = useState<MasterData[]>([]);
  const [sites,        setSites]        = useState<MasterData[]>([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [errors,       setErrors]       = useState<Record<string, string>>({});
  const [selectedTypeIsApar, setSelectedTypeIsApar] = useState(false);
  const [form, setForm] = useState({
    sarpras_type_id:   '',
    location_dept_id:  '',
    location_detail:   '',
    notes:             '',
    site:              '',
    pic:               '',
    is_critical:       false,
    has_alternative:   true,
    has_risk_location: false,
    expired_date:      ''
  });

  const clearErr = (k: string) =>
    setErrors(p => { const n = { ...p }; delete n[k]; return n; });

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.sarpras_type_id)        e.sarpras_type_id  = 'Jenis sarpras wajib dipilih';
    if (!form.location_dept_id)       e.location_dept_id = 'Departemen wajib dipilih';
    if (!form.location_detail.trim()) {
      e.location_detail = 'Lokasi detail tidak boleh kosong';
    } else if (!ALLOWED_TEXT_REGEX.test(form.location_detail)) {
      e.location_detail = 'Lokasi detail mengandung karakter yang tidak diizinkan';
    }
    if (!form.notes.trim()) {
      e.notes = "Catatan wajib diisi (tulis '-' jika tidak ada)";
    } else if (!ALLOWED_TEXT_REGEX.test(form.notes)) {
      e.notes = 'Catatan mengandung karakter yang tidak diizinkan';
    }
    if (selectedTypeIsApar) {
      if (!form.expired_date) {
        e.expired_date = 'Tanggal kadaluarsa wajib diisi untuk APAR';
      } else {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(form.expired_date)) {
          e.expired_date = 'Format tanggal harus YYYY-MM-DD';
        }
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  useEffect(() => {
    Promise.all([
      apiFetch(`${API_BASE}/departments`),
      apiFetch(`${API_BASE}/sarpras-types`),
      apiFetch(`${API_BASE}/sites`),
    ]).then(async ([dr, tr, sr]) => {
      if (dr.ok) { const j = await dr.json(); if (j.success) setDepartments(j.data); }
      if (tr.ok) { const j = await tr.json(); if (j.success) setSarprasTypes(j.data); }
      if (sr.ok) { const j = await sr.json(); if (j.success) setSites(j.data); }
    }).catch(console.error);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_BASE}/sarpras`, {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          sarpras_type_id:  parseInt(form.sarpras_type_id),
          location_dept_id: parseInt(form.location_dept_id),
          expired_date: form.expired_date ? form.expired_date : null,
        }),
      });
      const j = await res.json();
      if (res.ok && j.success) {
        setShowModal(true);
      } else {
        alert(j.message ?? 'Gagal menyimpan data.');
      }
    } catch { alert('Terjadi kesalahan saat menyimpan data.'); }
    finally { setIsLoading(false); }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setForm({
      sarpras_type_id: '', location_dept_id: '', location_detail: '',
      notes: '', site: '', pic: '', is_critical: false,
      has_alternative: true, has_risk_location: false, expired_date: '',
    });
    setSelectedTypeIsApar(false);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selected = sarprasTypes.find(t => t.id.toString() === selectedId);
    setForm(p => ({ ...p, sarpras_type_id: selectedId, pic: selected?.pic_dept_name ?? '' }));
    setSelectedTypeIsApar(selected?.is_apar ?? false);
    if (!selected?.is_apar) {
      setForm(p => ({ ...p, expired_date: '' }));
      clearErr('expired_date');
    }
    clearErr('sarpras_type_id');
  };

  const riskScore = (() => {
    const loc   = form.has_risk_location ? 3 : 1;
    const fatal = 1 + (form.is_critical ? 4 : 0) + (!form.has_alternative ? 2 : 0);
    return loc + fatal;
  })();
  const riskLevel =
    riskScore >= 10 ? 'very_high' :
    riskScore >= 8  ? 'high'      :
    riskScore >= 6  ? 'medium'    : 'low';
  const riskCfg = RISK_STYLE[riskLevel as keyof typeof RISK_STYLE];

  useEffect(() => {
    if (sites.length > 0 && !form.site) {
      setForm(prev => ({ ...prev, site: sites[0].name }));
    }
  }, [sites]);

  return (
    <>
      <SuccessModal
        open={showModal}
        title="Request Berhasil Dikirim!"
        desc="Permintaan tambah sarpras telah masuk ke antrian approval. Supervisor / QS Admin akan memproses request ini."
        onClose={handleModalClose}
      />

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border-t-[5px] border-t-[#003d7a] overflow-hidden"
      >
        <div className="p-4 sm:p-6 lg:p-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">

            <div className="space-y-5 sm:space-y-6">
              <SectionTitle label="Informasi Dasar" />

              <Field label="Jenis Sarpras" required error={errors.sarpras_type_id}>
                <select
                  value={form.sarpras_type_id}
                  onChange={handleTypeChange}
                  className={inputCls(!!errors.sarpras_type_id)}
                >
                  <option value="">Pilih Jenis</option>
                  {sarprasTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Field>

              <Field label="Site">
                <input disabled value={form.site} className={inputCls(false) + ' text-gray-500 cursor-not-allowed'} />
              </Field>

              <Field label="Departemen" required error={errors.location_dept_id}>
                <select
                  value={form.location_dept_id}
                  onChange={e => { setForm(p => ({ ...p, location_dept_id: e.target.value })); clearErr('location_dept_id'); }}
                  className={inputCls(!!errors.location_dept_id)}
                >
                  <option value="">Pilih Departemen</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>

              <Field label="Departemen Responsibility">
                <input
                  disabled
                  value={form.pic}
                  placeholder="Pilih jenis sarpras dulu..."
                  className={inputCls(false) + ' text-gray-500 cursor-not-allowed'}
                />
              </Field>

              {selectedTypeIsApar && (
                <Field label="Tanggal Kadaluarsa" required error={errors.expired_date}>
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={form.expired_date}
                    onChange={e => {
                      setForm(p => ({ ...p, expired_date: e.target.value }));
                      clearErr('expired_date');
                    }}
                    className={inputCls(!!errors.expired_date)}
                  />
                </Field>
              )}
            </div>

            <div className="space-y-5 sm:space-y-6">
              <SectionTitle label="Detail Penempatan" />

              <Field label="Lokasi Detail" required error={errors.location_detail}>
                <div className="relative">
                  <textarea
                    rows={6}
                    value={form.location_detail}
                    onChange={e => {
                      const sanitized = sanitizeText(e.target.value);
                      setForm(p => ({ ...p, location_detail: sanitized }));
                      clearErr('location_detail');
                    }}
                    placeholder="Berada di dekat pintu 1..."
                    maxLength={500}
                    className={inputCls(!!errors.location_detail) + ' resize-none'}
                  />
                  <div className="absolute bottom-3 right-3 bg-white px-2 py-1 rounded text-[11px] font-bold text-gray-400 shadow-sm">
                    {form.location_detail.length}<span className="font-normal"> / 500</span>
                  </div>
                </div>
              </Field>

              <Field label="Notes" required error={errors.notes}>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={e => {
                    const sanitized = sanitizeText(e.target.value);
                    setForm(p => ({ ...p, notes: sanitized }));
                    clearErr('notes');
                  }}
                  placeholder="Tambahkan catatan jika ada..."
                  className={inputCls(!!errors.notes) + ' resize-none'}
                />
              </Field>
            </div>
          </div>

          <hr className="my-8 sm:my-10 border-gray-100" />

          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-3 mb-5 sm:mb-6">
              <div>
                <SectionTitle label="Analisis Risiko" accent="red" />
                <h4 className="text-base sm:text-lg font-bold text-gray-900 mt-1">Kategori Risiko</h4>
              </div>
              <div className={`inline-flex w-fit px-4 py-2 rounded-md font-bold text-sm tracking-wide shadow-sm ${riskCfg.bg} ${riskCfg.text}`}>
                KATEGORI: {riskCfg.label.toUpperCase()}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
              <RiskCard icon="!" title="Berakibat fatal jika tidak ada?" desc="Apakah sarpras ini kritis untuk operasional darurat?"
                active={form.is_critical} onToggle={v => setForm(p => ({ ...p, is_critical: v }))} />
              <RiskCard icon="⑂" title="Ada alternatif lain?" desc="Apakah ada sarana pengganti jika ini tidak tersedia?"
                active={form.has_alternative} onToggle={v => setForm(p => ({ ...p, has_alternative: v }))} />
              <RiskCard icon="⚠" title="Lokasi sarpras berada di area berisiko tertinggi?" desc="Apakah area penempatan memiliki tingkat risiko kecelakaan tinggi?"
                active={form.has_risk_location} onToggle={v => setForm(p => ({ ...p, has_risk_location: v }))} />
            </div>
          </div>
        </div>

        <div className="bg-white border-t border-gray-100 p-4 sm:p-6 sm:px-10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm font-bold text-gray-500 hover:text-gray-800 transition-all text-center py-2 sm:py-0"
          >
            Batalkan
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 bg-[#003d7a] text-white px-6 sm:px-8 py-3 rounded-md font-bold shadow-md hover:bg-[#002d5a] transition-all disabled:opacity-50 w-full sm:w-auto"
          >
            <SaveIcon />
            {isLoading ? 'Mengirim Request...' : 'Submit'}
          </button>
        </div>
      </form>
    </>
  );
}

function ExcelImport() {
  const [phase,        setPhase]        = useState<ImportPhase>('upload');
  const [parseData,    setParseData]    = useState<BulkParseResponse | null>(null);
  const [filter,       setFilter]       = useState<'all' | 'valid' | 'error'>('all');
  const [search,       setSearch]       = useState('');
  const [isDragging,   setIsDragging]   = useState(false);
  const [isParsing,    setIsParsing]    = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMsg,    setSubmitMsg]    = useState('');
  const [parseError,   setParseError]   = useState('');
  const [showModal,    setShowModal]    = useState(false);
  const [notes,        setNotes]        = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    window.location.href = `${API_BASE}/sarpras/template`;
  };

  const uploadFile = useCallback(async (file: File) => {
    setIsParsing(true);
    setParseError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await apiFetch(`${API_BASE}/sarpras/parse`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setParseError(json.error ?? 'Gagal membaca file.');
        return;
      }
      setParseData(json.data as BulkParseResponse);
      setFilter('all');
      setSearch('');
      setPhase('validate');
    } catch (err) {
      setParseError('Terjadi kesalahan: ' + (err as Error).message);
    } finally {
      setIsParsing(false);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) uploadFile(e.target.files[0]);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files[0]) uploadFile(e.dataTransfer.files[0]);
  };

  const exportErrors = async () => {
    if (!parseData) return;
    try {
      const res = await apiFetch(`${API_BASE}/sarpras/export-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parseData.rows.filter(r => !r.valid) }),
      });
      if (!res.ok) { alert('Gagal generate file error.'); return; }
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'sarpras_import_errors.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Gagal export: ' + (err as Error).message); }
  };

  const handleSubmit = async () => {
    if (!parseData) return;
    setIsSubmitting(true);
    const items = parseData.rows.map(r => ({
      sarpras_type_code:  r.sarpras_type_code,
      location_dept_code: r.location_dept_code,
      site_code:          r.site_code,
      location_detail:    r.location_detail,
      is_critical:        r.is_critical,
      has_alternative:    r.has_alternative,
      has_risk_location:  r.has_risk_location,
      expired_date:       r.expired_date || null,
    }));
    const payload = { items, notes: notes.trim() || 'Tambah Sarpras Via Excel' };
    try {
      setSubmitMsg('Memvalidasi ke server...');
      const valRes  = await apiFetch(`${API_BASE}/sarpras/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const valJson = await valRes.json();
      if (!valJson.success || !valJson.data?.valid) {
        alert(`Validasi server gagal: ${valJson.message ?? ''}\n${valJson.data?.error_rows ?? 0} baris tidak valid di master database.`);
        return;
      }
      setSubmitMsg('Mengirim request approval...');
      const reqRes  = await apiFetch(`${API_BASE}/sarpras/import/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const reqJson = await reqRes.json();
      if (reqRes.ok && reqJson.success) {
        setShowModal(true);
      } else {
        alert(`Request gagal: ${reqJson.message ?? 'Terjadi kesalahan.'}`);
      }
    } catch (err) {
      alert('Terjadi kesalahan: ' + (err as Error).message);
    } finally {
      setIsSubmitting(false);
      setSubmitMsg('');
    }
  };

  const handleModalClose = () => {
    setShowModal(false);
    setPhase('upload');
    setParseData(null);
    setParseError('');
    setNotes('');
  };

  const validRows    = parseData?.rows.filter(r => r.valid)  ?? [];
  const errorRows    = parseData?.rows.filter(r => !r.valid) ?? [];
  const allValid     = parseData?.all_valid ?? false;
  const filteredRows = (parseData?.rows ?? []).filter(r => {
    if (filter === 'valid' && !r.valid) return false;
    if (filter === 'error' && r.valid)  return false;
    if (search) {
      const q = search.toLowerCase();
      return [r.sarpras_type_code, r.location_dept_code, r.site_code, r.location_detail]
        .some(v => v?.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <>
      <SuccessModal
        open={showModal}
        title="Request Import Berhasil Dikirim!"
        desc={`${validRows.length} sarpras telah diajukan ke antrian approval. Supervisor / QS Admin akan memproses request ini sebelum data masuk ke sistem.`}
        onClose={handleModalClose}
      />

      <div className="space-y-4">

        {phase === 'upload' && (
          <>
            <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
              <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-gray-100">
                <StepBadge n={1} />
                <div>
                  <p className="font-bold text-gray-900 text-sm sm:text-base">Download Template Excel</p>
                  <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">
                    Silahkan menggunakan template yang sudah disediakan.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto border-b border-gray-100 -mx-0">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {['#', 'Nama Kolom', 'Status', 'Format', 'Contoh Nilai'].map(h => (
                        <th key={h} className="text-left px-3 sm:px-4 py-3 text-[10px] sm:text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {([
                      [1, 'sarpras_type_code',  true,  'Dropdown',     'APR, APB, EML'],
                      [2, 'location_dept_code', true,  'Dropdown',     'ENG, PROD, QAQS, QC'],
                      [3, 'location_detail',    true,  'Teks, maks 255 karakter',    'Dekat pintu lobby utama'],
                      [4, 'is_critical',        true,  'ya / tidak (dropdown)', 'ya'],
                      [5, 'has_alternative',    true,  'ya / tidak (dropdown)', 'tidak'],
                      [6, 'has_risk_location',  true,  'ya / tidak (dropdown)', 'ya'],
                      [7, 'expired_date',       false, 'YYYY-MM-DD',            '2027-06-30'],
                    ] as [number, string, boolean, string, string][]).map(([no, col, req, fmt, ex]) => (
                      <tr key={col} className="hover:bg-gray-50/60">
                        <td className="px-3 sm:px-4 py-2.5 text-xs text-gray-400">{no}</td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <code className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-mono">{col}</code>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap bg-red-50 text-red-600`}>
                            {req ? 'Wajib' : 'Wajib untuk APR & APB'}
                          </span>
                        </td>
                        <td className="px-3 sm:px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{fmt}</td>
                        <td className="px-3 sm:px-4 py-2.5 text-xs text-gray-400 font-mono whitespace-nowrap">{ex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-50/50 gap-3">
                <p className="text-xs text-gray-700 font-bold">
                  <span className="text-red-500">*</span> <code className="font-mono font-bold text-[11px]">expired_date</code> wajib diisi untuk APR & APB
                </p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 bg-[#003d7a] text-white px-4 sm:px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-[#002d5a] transition-all shadow-sm w-full sm:w-auto justify-center"
                >
                  <DownloadIcon /> Download Template
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
              <div className="flex items-start gap-3 p-4 sm:p-5 border-b border-gray-100">
                <StepBadge n={2} />
                <div>
                  <p className="font-bold text-gray-900 text-sm sm:text-base">Upload File Excel yang Sudah Diisi</p>
                  <p className="text-xs text-gray-400 mt-0.5">Ketentuan maksimal 5.000 baris dan maksimal ukuran 10 MB</p>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                {parseError && (
                  <div className="mb-4 flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    <ExclamationIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    {parseError}
                  </div>
                )}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !isParsing && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 sm:p-14 text-center transition-all duration-200 select-none ${
                    isParsing
                      ? 'border-[#003d7a] bg-blue-50/30 cursor-wait'
                      : isDragging
                        ? 'border-[#003d7a] bg-blue-50/60 scale-[1.01] cursor-copy'
                        : 'border-gray-200 hover:border-[#003d7a]/40 hover:bg-gray-50/50 cursor-pointer'
                  }`}
                >
                  {isParsing ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-2 border-[#003d7a] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm font-semibold text-[#003d7a]">Membaca dan memvalidasi file...</p>
                    </div>
                  ) : (
                    <>
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 transition-colors ${isDragging ? 'bg-[#003d7a]/10' : 'bg-gray-100'}`}>
                        <TableIcon className={`w-6 h-6 sm:w-7 sm:h-7 ${isDragging ? 'text-[#003d7a]' : 'text-gray-400'}`} />
                      </div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">
                        <span className="hidden sm:inline">Drag & drop file di sini, atau </span>
                        <span className="sm:hidden">Tap untuk pilih file</span>
                        <span className="hidden sm:inline">klik untuk pilih</span>
                      </p>
                      <p className="text-xs text-gray-400">.xlsx .xls .csv</p>
                    </>
                  )}
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
                </div>
              </div>
            </div>
          </>
        )}

        {phase === 'validate' && parseData && (
          <>
            {allValid ? (
              <Alert variant="success">
                <strong>Semua {parseData.total_rows} baris valid.</strong>
                {' '}Tambahkan catatan lalu kirim request approval.
              </Alert>
            ) : (
              <Alert variant="error">
                <strong>{parseData.error_rows} baris memiliki error.</strong>
                {' '}Perbaiki file Excel dan upload ulang. Request <strong>tidak akan dikirim</strong> selama masih ada baris error.
              </Alert>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                { label: 'Total Baris', val: parseData.total_rows, cls: 'text-gray-900' },
                { label: 'Valid',       val: parseData.valid_rows, cls: 'text-green-600' },
                { label: 'Error',       val: parseData.error_rows, cls: 'text-red-500' },
                {
                  label: 'Siap Request',
                  val: `${Math.round((parseData.valid_rows / parseData.total_rows) * 100)}%`,
                  cls: allValid ? 'text-green-600' : 'text-amber-500',
                },
              ].map(m => (
                <div key={m.label} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-100 shadow-sm">
                  <p className="text-[10px] sm:text-[11px] text-gray-400 uppercase tracking-wide mb-1">{m.label}</p>
                  <p className={`text-xl sm:text-2xl font-bold ${m.cls}`}>{m.val}</p>
                </div>
              ))}
            </div>

            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${allValid ? 'bg-green-500' : 'bg-red-400'}`}
                style={{ width: `${(parseData.valid_rows / parseData.total_rows) * 100}%` }}
              />
            </div>

            {allValid && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Catatan Request
                  <span className="ml-1 text-[11px] font-normal text-gray-400">(opsional)</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(sanitizeText(e.target.value))}
                  placeholder="Contoh: Import sarpras batch Q2 2026 — area Cikarang baru"
                  className="w-full bg-[#f1f5f9] border-none rounded-lg px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:ring-2 focus:ring-[#003d7a] resize-none transition-all"
                />
              </div>
            )}

            <div className="bg-white rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <TableIcon className="w-4 h-4 text-gray-400" />
                  Tabel Validasi
                </div>
                <div className="flex items-center gap-2 sm:ml-auto flex-wrap w-full sm:w-auto">
                  <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                    {(['all', 'valid', 'error'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-2 sm:px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
                          filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-400 hover:text-gray-700'
                        }`}
                      >
                        {f === 'all'   ? 'Semua' :
                         f === 'valid' ? `Valid (${validRows.length})` :
                                        `Error (${errorRows.length})`}
                      </button>
                    ))}
                  </div>
                  <div className="relative flex-1 sm:flex-none">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari kode / lokasi..."
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003d7a]/30 w-full sm:w-44"
                    />
                  </div>
                  <span className="text-xs text-gray-400 tabular-nums hidden sm:inline">
                    {filteredRows.length}/{parseData.total_rows}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-[400px] sm:max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm min-w-[800px]">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 border-b border-gray-100">
                      {['Baris', 'Jenis', 'Dept', 'Site', 'Lokasi Detail', 'Kritis', 'Alternatif', 'Area Risiko', 'Risiko', 'Expired', 'Status'].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-12 sm:py-16 text-center text-sm text-gray-400">
                          Tidak ada baris yang cocok
                        </td>
                      </tr>
                    ) : filteredRows.map(r => (
                      <tr
                        key={r.row}
                        className={r.valid
                          ? 'hover:bg-gray-50/60 transition-colors'
                          : 'bg-red-50/60 hover:bg-red-50 transition-colors'
                        }
                      >
                        <td className="px-3 py-2.5 text-xs text-gray-400 font-mono">{r.row}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-gray-800">{r.sarpras_type_code || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{r.location_dept_code || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600">{r.site_code || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-600 max-w-40">
                          <span className="block truncate" title={r.location_detail}>{r.location_detail || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs"><BoolChip val={r.is_critical} /></td>
                        <td className="px-3 py-2.5 text-xs"><BoolChip val={r.has_alternative} /></td>
                        <td className="px-3 py-2.5 text-xs"><BoolChip val={r.has_risk_location} /></td>
                        <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                          <span className="font-bold text-gray-700 mr-1.5">{r.risk_score}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${RISK_BADGE[r.risk_level]}`}>
                            {{ low: 'Low', medium: 'Med', high: 'High', very_high: 'V.High' }[r.risk_level]}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-gray-500 font-mono">{r.expired_date || '—'}</td>
                        <td className="px-3 py-2.5">
                          {r.valid ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                              <CheckIcon className="w-3 h-3" /> Valid
                            </span>
                          ) : (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                                <XIcon className="w-3 h-3" /> Error
                              </span>
                              {r.errors.map((err, i) => (
                                <p key={i} className="text-[11px] text-red-600 flex items-start gap-1 leading-snug">
                                  <span className="shrink-0 mt-0.5">·</span>{err}
                                </p>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => { setPhase('upload'); setParseData(null); setParseError(''); setNotes(''); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                >
                  <UploadIcon /> Upload File Lain
                </button>
                {errorRows.length > 0 && (
                  <button
                    type="button"
                    onClick={exportErrors}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 rounded-lg text-sm font-semibold text-red-600 hover:bg-red-50 transition-all"
                  >
                    <DownloadIcon /> Export Error ({errorRows.length})
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={!allValid || isSubmitting}
                onClick={handleSubmit}
                className="flex items-center justify-center gap-2 bg-[#003d7a] text-white px-6 sm:px-8 py-2.5 rounded-lg text-sm font-bold hover:bg-[#002d5a] transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {submitMsg || 'Memproses...'}
                  </>
                ) : (
                  <>
                    <SendIcon /> Request Import ({validRows.length} sarpras)
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SectionTitle({ label, accent = 'blue' }: { label: string; accent?: 'blue' | 'red' }) {
  return (
    <div className="flex items-center gap-2 mb-4 sm:mb-6">
      <div className={`w-2 h-2 rounded-full shrink-0 ${accent === 'red' ? 'bg-red-500' : 'bg-[#003d7a]'}`} />
      <h3 className="text-[11px] sm:text-[13px] font-bold text-gray-400 tracking-widest uppercase">{label}</h3>
    </div>
  );
}

function Field({ label, required, error, children }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-bold text-gray-700 mb-1.5 sm:mb-2">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-red-500 text-[11px] mt-1 font-bold">{error}</p>}
    </div>
  );
}

const inputCls = (hasError: boolean) =>
  `w-full bg-[#f1f5f9] border-none rounded-lg px-4 py-3 sm:py-3.5 text-sm font-medium text-gray-800 outline-none focus:ring-2 transition-all ${
    hasError ? 'ring-2 ring-red-500' : 'focus:ring-[#003d7a]'
  }`;

function RiskCard({ icon, title, desc, active, onToggle }: {
  icon: string; title: string; desc: string; active: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <div className="bg-[#f8f9fa] rounded-xl p-4 sm:p-5 relative border border-gray-100">
      <div className="w-8 h-8 bg-white border border-gray-200 rounded-md flex items-center justify-center font-bold text-gray-500 mb-3 sm:mb-4 shadow-sm text-sm">
        {icon}
      </div>
      <div className="absolute top-4 sm:top-5 right-4 sm:right-5 flex bg-gray-200/60 p-1 rounded-md">
        <button type="button" onClick={() => onToggle(true)}
          className={`px-2 sm:px-3 py-1 text-[11px] font-bold rounded transition-all ${active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
          YES
        </button>
        <button type="button" onClick={() => onToggle(false)}
          className={`px-2 sm:px-3 py-1 text-[11px] font-bold rounded transition-all ${!active ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400'}`}>
          NO
        </button>
      </div>
      <h4 className="text-[13px] font-bold text-gray-900 mb-1.5 pr-20 leading-snug">{title}</h4>
      <p className="text-[11px] text-gray-500 leading-relaxed">{desc}</p>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#003d7a] text-white flex items-center justify-center text-xs sm:text-sm font-bold shrink-0">
      {n}
    </div>
  );
}

function BoolChip({ val }: { val: boolean }) {
  return (
    <span className={`text-[11px] font-semibold ${val ? 'text-green-700' : 'text-gray-400'}`}>
      {val ? 'Ya' : 'Tidak'}
    </span>
  );
}

function Alert({ variant, children }: { variant: 'success' | 'error'; children: React.ReactNode }) {
  const cfg = variant === 'success'
    ? { bg: 'bg-green-50 border-green-200', text: 'text-green-800', icon: <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 shrink-0 mt-0.5" /> }
    : { bg: 'bg-red-50 border-red-200',     text: 'text-red-800',   icon: <ExclamationIcon className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 shrink-0 mt-0.5" /> };
  return (
    <div className={`flex items-start gap-3 px-4 sm:px-5 py-3 sm:py-4 border rounded-xl ${cfg.bg}`}>
      {cfg.icon}
      <div className={`text-xs sm:text-sm ${cfg.text}`}>{children}</div>
    </div>
  );
}

const ArrowLeftIcon   = () => <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>;
const PencilIcon      = () => <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const TableIcon       = ({ className = 'w-4 h-4' }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>;
const DownloadIcon    = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>;
const UploadIcon      = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>;
const SaveIcon        = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>;
const SendIcon        = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>;
const CheckIcon       = ({ className = 'w-4 h-4' }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>;
const XIcon           = ({ className = 'w-4 h-4' }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>;
const SearchIcon      = ({ className = 'w-4 h-4' }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>;
const ExclamationIcon = ({ className = 'w-4 h-4' }: { className?: string }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>;
