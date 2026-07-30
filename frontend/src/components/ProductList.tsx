import type { DiversifikasiProduk, DiversifikasiProdukPM, HasilAnalisa, StatusRM } from "../types/types"

const HASIL_OPTIONS: HasilAnalisa[] = ["MS", "TMS", "OP", "N/A"]
const STATUS_OPTIONS: StatusRM[] = ["Reject", "Release", "On Progress", "N/A"]

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
)

const toStr = (val: string | null | undefined): string => {
  if (!val) return ""
  if (val.length > 10 && val.includes("T")) return val.slice(0, 10)
  return val
}

const inputClass = "w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors disabled:cursor-not-allowed"
const selectClass = inputClass + " appearance-none"
const labelClass = "block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1"

function SelectHasil({ label, value, onChange, disabled, id }: {
  label: string; value: string; onChange: (v: string) => void; disabled: boolean; id?: string
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select id={id} name={id} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className={selectClass}>
        <option value="">Pilih</option>
        {HASIL_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

function SelectStatus({ label, value, onChange, disabled, id }: {
  label: string; value: string; onChange: (v: string) => void; disabled: boolean; id?: string
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <select id={id} name={id} value={value} onChange={e => onChange(e.target.value)} disabled={disabled} className={selectClass}>
        <option value="">Pilih</option>
        {STATUS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )
}

const EMPTY_PRODUCT_RM: DiversifikasiProduk = {
  kodeProduk: "", produkTglKirimQC: null, produkTglKeluarHasil: null,
  produkFisik: "", produkKimia: "", produkMikrobiologi: "", produkSensori: "",
  produkCekKarakteristik: "", stabtestFisik: "", stabtestKimia: "",
  stabtestMikrobiologi: "", stabtestSensoriDFCT: "", stabtestStatus: "", keterangan: "",
}

const EMPTY_PRODUCT_PM: DiversifikasiProdukPM = {
  kodeProduk: "", produkTglKirimQC: null, produkTglKeluarHasil: null,
  evaluasiAsKemasan: "", produkFisik: "", produkKimia: "", produkMikrobiologi: "",
  produkSensori: "", produkCekKarakteristik: "", stabtestFisik: "", stabtestKimia: "",
  stabtestMikrobiologi: "", stabtestSensoriDFCT: "", stabtestKeterangan: "", stabtestStatus: "",
}

interface ProductListRMProps {
  variant: "rm"
  products: DiversifikasiProduk[]
  onChange: (products: DiversifikasiProduk[]) => void
  canEdit: boolean
}

function ProductListRM({ products, onChange, canEdit }: Omit<ProductListRMProps, "variant">) {
  const add = () => onChange([...products, { ...EMPTY_PRODUCT_RM }])
  const remove = (i: number) => onChange(products.filter((_, idx) => idx !== i))

  const update = (index: number, field: keyof DiversifikasiProduk, value: string) => {
    const updated = products.map((p, i) => {
      if (i !== index) return p
      const next: DiversifikasiProduk = {
        ...p,
        [field]: field === "produkTglKirimQC" || field === "produkTglKeluarHasil" ? (value || null) : value,
      }
      if (field === "produkTglKirimQC" && value) {
        if (!p.produkFisik) next.produkFisik = "OP"
        if (!p.produkKimia) next.produkKimia = "OP"
        if (!p.produkMikrobiologi) next.produkMikrobiologi = "OP"
        if (!p.produkSensori) next.produkSensori = "OP"
        if (!p.produkCekKarakteristik) next.produkCekKarakteristik = "OP"
        if (!p.stabtestFisik) next.stabtestFisik = "OP"
        if (!p.stabtestKimia) next.stabtestKimia = "OP"
        if (!p.stabtestMikrobiologi) next.stabtestMikrobiologi = "OP"
        if (!p.stabtestSensoriDFCT) next.stabtestSensoriDFCT = "OP"
        if (!p.stabtestStatus) next.stabtestStatus = "On Progress"
      }
      return next
    })
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">Alokasi Produk &amp; Stabtest</h4>
        {canEdit && (
          <button type="button" onClick={add}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#80bc00] hover:bg-[#6da300] text-white text-xs font-semibold transition-colors">
            <PlusIcon /> Tambah Produk
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-neutral-800/50 rounded-lg border border-dashed border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">Belum ada produk. Klik "Tambah Produk" untuk menambahkan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product, index) => (
            <div key={index} className="p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-lg border border-gray-200 dark:border-neutral-700 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-neutral-700">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Produk #{index + 1}</span>
                {canEdit && (
                  <button type="button" onClick={() => remove(index)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                    <TrashIcon /> Hapus
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Kode Produk</label>
                  <input id={`rm-kodeProduk-${index}`} name={`rm-kodeProduk-${index}`} type="text" value={toStr(product.kodeProduk)}
                    onChange={e => update(index, "kodeProduk", e.target.value)}
                    disabled={!canEdit} placeholder="Ketik kode produk..." className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Tgl Kirim QC</label>
                  <input id={`rm-tglKirimQC-${index}`} name={`rm-tglKirimQC-${index}`} type="date" value={toStr(product.produkTglKirimQC)}
                    onChange={e => update(index, "produkTglKirimQC", e.target.value)}
                    disabled={!canEdit} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Tgl Keluar Hasil</label>
                  <input id={`rm-tglKeluarHasil-${index}`} name={`rm-tglKeluarHasil-${index}`} type="date" value={toStr(product.produkTglKeluarHasil)}
                    onChange={e => update(index, "produkTglKeluarHasil", e.target.value)}
                    disabled={!canEdit} className={inputClass} />
                </div>
                <SelectHasil id={`rm-produkFisik-${index}`} label="Fisik" value={toStr(product.produkFisik)} onChange={v => update(index, "produkFisik", v)} disabled={!canEdit} />
                <SelectHasil id={`rm-produkKimia-${index}`} label="Kimia" value={toStr(product.produkKimia)} onChange={v => update(index, "produkKimia", v)} disabled={!canEdit} />
                <SelectHasil id={`rm-produkMikrobiologi-${index}`} label="Mikrobiologi" value={toStr(product.produkMikrobiologi)} onChange={v => update(index, "produkMikrobiologi", v)} disabled={!canEdit} />
                <SelectHasil id={`rm-produkSensori-${index}`} label="Sensori" value={toStr(product.produkSensori)} onChange={v => update(index, "produkSensori", v)} disabled={!canEdit} />
                <div className="col-span-2">
                  <SelectHasil id={`rm-produkCekKarakteristik-${index}`} label="Cek Karakteristik Produk" value={toStr(product.produkCekKarakteristik)} onChange={v => update(index, "produkCekKarakteristik", v)} disabled={!canEdit} />
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-neutral-700">
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-3">Stabtest</p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectHasil id={`rm-stabtestFisik-${index}`} label="Fisik" value={toStr(product.stabtestFisik)} onChange={v => update(index, "stabtestFisik", v)} disabled={!canEdit} />
                  <SelectHasil id={`rm-stabtestKimia-${index}`} label="Kimia" value={toStr(product.stabtestKimia)} onChange={v => update(index, "stabtestKimia", v)} disabled={!canEdit} />
                  <SelectHasil id={`rm-stabtestMikrobiologi-${index}`} label="Mikrobiologi" value={toStr(product.stabtestMikrobiologi)} onChange={v => update(index, "stabtestMikrobiologi", v)} disabled={!canEdit} />
                  <SelectHasil id={`rm-stabtestSensoriDFCT-${index}`} label="Sensori DFCT" value={toStr(product.stabtestSensoriDFCT)} onChange={v => update(index, "stabtestSensoriDFCT", v)} disabled={!canEdit} />
                  <SelectStatus id={`rm-stabtestStatus-${index}`} label="Status" value={toStr(product.stabtestStatus)} onChange={v => update(index, "stabtestStatus", v)} disabled={!canEdit} />
                  <div className="col-span-2">
                    <label className={labelClass}>Keterangan</label>
                    <textarea id={`rm-keterangan-${index}`} name={`rm-keterangan-${index}`} value={toStr(product.keterangan)} onChange={e => update(index, "keterangan", e.target.value)}
                      disabled={!canEdit} rows={2}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors resize-none disabled:cursor-not-allowed" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {products.length === 0 && canEdit && (
        <button type="button" onClick={add}
          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-[#80bc00] hover:text-[#80bc00] transition-colors">
          + Klik untuk menambahkan produk pertama
        </button>
      )}
    </div>
  )
}

interface ProductListPMProps {
  variant: "pm"
  products: DiversifikasiProdukPM[]
  onChange: (products: DiversifikasiProdukPM[]) => void
  canEdit: boolean
}

function ProductListPM({ products, onChange, canEdit }: Omit<ProductListPMProps, "variant">) {
  const add = () => onChange([...products, { ...EMPTY_PRODUCT_PM }])
  const remove = (i: number) => onChange(products.filter((_, idx) => idx !== i))

  const update = (index: number, field: keyof DiversifikasiProdukPM, value: string) => {
    const updated = products.map((p, i) => {
      if (i !== index) return p
      const next: DiversifikasiProdukPM = {
        ...p,
        [field]: field === "produkTglKirimQC" || field === "produkTglKeluarHasil" ? (value || null) : value,
      }
      if (field === "produkTglKirimQC" && value) {
        if (!p.evaluasiAsKemasan) next.evaluasiAsKemasan = "OP"
        if (!p.produkFisik) next.produkFisik = "OP"
        if (!p.produkKimia) next.produkKimia = "OP"
        if (!p.produkMikrobiologi) next.produkMikrobiologi = "OP"
        if (!p.produkSensori) next.produkSensori = "OP"
        if (!p.produkCekKarakteristik) next.produkCekKarakteristik = "OP"
        if (!p.stabtestFisik) next.stabtestFisik = "OP"
        if (!p.stabtestKimia) next.stabtestKimia = "OP"
        if (!p.stabtestMikrobiologi) next.stabtestMikrobiologi = "OP"
        if (!p.stabtestSensoriDFCT) next.stabtestSensoriDFCT = "OP"
        if (!p.stabtestStatus) next.stabtestStatus = "On Progress"
      }
      return next
    })
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-gray-700 dark:text-gray-200">Alokasi Produk Labscale Kemasan Primer</h4>
        {canEdit && (
          <button type="button" onClick={add}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#80bc00] hover:bg-[#6da300] text-white text-xs font-semibold transition-colors">
            <PlusIcon /> Tambah Produk
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 dark:bg-neutral-800/50 rounded-lg border border-dashed border-gray-200 dark:border-neutral-700">
          <p className="text-sm text-gray-400 dark:text-gray-500">Belum ada produk. Klik "Tambah Produk" untuk menambahkan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((product, index) => (
            <div key={index} className="p-4 bg-gray-50 dark:bg-neutral-800/50 rounded-lg border border-gray-200 dark:border-neutral-700 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-gray-200 dark:border-neutral-700">
                <span className="text-xs font-bold text-gray-600 dark:text-gray-300">Produk #{index + 1}</span>
                {canEdit && (
                  <button type="button" onClick={() => remove(index)}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                    <TrashIcon /> Hapus
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelClass}>Kode Produk</label>
                  <input id={`pm-kodeProduk-${index}`} name={`pm-kodeProduk-${index}`} type="text" value={toStr(product.kodeProduk)}
                    onChange={e => update(index, "kodeProduk", e.target.value)}
                    disabled={!canEdit} placeholder="Ketik kode produk..." className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Tgl Kirim QC</label>
                  <input id={`pm-tglKirimQC-${index}`} name={`pm-tglKirimQC-${index}`} type="date" value={toStr(product.produkTglKirimQC)}
                    onChange={e => update(index, "produkTglKirimQC", e.target.value)}
                    disabled={!canEdit} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Tgl Keluar Hasil</label>
                  <input id={`pm-tglKeluarHasil-${index}`} name={`pm-tglKeluarHasil-${index}`} type="date" value={toStr(product.produkTglKeluarHasil)}
                    onChange={e => update(index, "produkTglKeluarHasil", e.target.value)}
                    disabled={!canEdit} className={inputClass} />
                </div>

                <div className="col-span-2">
                  <SelectHasil id={`pm-evaluasiAsKemasan-${index}`} label="Evaluasi as Kemasan" value={toStr(product.evaluasiAsKemasan)} onChange={v => update(index, "evaluasiAsKemasan", v)} disabled={!canEdit} />
                </div>

                <SelectHasil id={`pm-produkFisik-${index}`} label="Fisik" value={toStr(product.produkFisik)} onChange={v => update(index, "produkFisik", v)} disabled={!canEdit} />
                <SelectHasil id={`pm-produkKimia-${index}`} label="Kimia" value={toStr(product.produkKimia)} onChange={v => update(index, "produkKimia", v)} disabled={!canEdit} />
                <SelectHasil id={`pm-produkMikrobiologi-${index}`} label="Mikrobiologi" value={toStr(product.produkMikrobiologi)} onChange={v => update(index, "produkMikrobiologi", v)} disabled={!canEdit} />
                <SelectHasil id={`pm-produkSensori-${index}`} label="Sensori" value={toStr(product.produkSensori)} onChange={v => update(index, "produkSensori", v)} disabled={!canEdit} />
                <div className="col-span-2">
                  <SelectHasil id={`pm-produkCekKarakteristik-${index}`} label="Cek Karakteristik Produk" value={toStr(product.produkCekKarakteristik)} onChange={v => update(index, "produkCekKarakteristik", v)} disabled={!canEdit} />
                </div>
              </div>

              <div className="pt-3 mt-3 border-t border-gray-200 dark:border-neutral-700">
                <p className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-3">Stabtest</p>
                <div className="grid grid-cols-2 gap-3">
                  <SelectHasil id={`pm-stabtestFisik-${index}`} label="Fisik" value={toStr(product.stabtestFisik)} onChange={v => update(index, "stabtestFisik", v)} disabled={!canEdit} />
                  <SelectHasil id={`pm-stabtestKimia-${index}`} label="Kimia" value={toStr(product.stabtestKimia)} onChange={v => update(index, "stabtestKimia", v)} disabled={!canEdit} />
                  <SelectHasil id={`pm-stabtestMikrobiologi-${index}`} label="Mikrobiologi" value={toStr(product.stabtestMikrobiologi)} onChange={v => update(index, "stabtestMikrobiologi", v)} disabled={!canEdit} />
                  <SelectHasil id={`pm-stabtestSensoriDFCT-${index}`} label="Sensori DFCT" value={toStr(product.stabtestSensoriDFCT)} onChange={v => update(index, "stabtestSensoriDFCT", v)} disabled={!canEdit} />
                  <SelectStatus id={`pm-stabtestStatus-${index}`} label="Status" value={toStr(product.stabtestStatus)} onChange={v => update(index, "stabtestStatus", v)} disabled={!canEdit} />
                  <div className="col-span-2">
                    <label className={labelClass}>Keterangan Stabtest</label>
                    <textarea id={`pm-stabtestKeterangan-${index}`} name={`pm-stabtestKeterangan-${index}`} value={toStr(product.stabtestKeterangan)} onChange={e => update(index, "stabtestKeterangan", e.target.value)}
                      disabled={!canEdit} rows={2}
                      className="w-full px-2.5 py-1.5 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors resize-none disabled:cursor-not-allowed" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {products.length === 0 && canEdit && (
        <button type="button" onClick={add}
          className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-lg text-sm text-gray-500 dark:text-gray-400 hover:border-[#80bc00] hover:text-[#80bc00] transition-colors">
          + Klik untuk menambahkan produk pertama
        </button>
      )}
    </div>
  )
}

type ProductListProps = ProductListRMProps | ProductListPMProps

export default function ProductList(props: ProductListProps) {
  if (props.variant === "pm") {
    return <ProductListPM products={props.products} onChange={props.onChange} canEdit={props.canEdit} />
  }
  return <ProductListRM products={props.products} onChange={props.onChange} canEdit={props.canEdit} />
}