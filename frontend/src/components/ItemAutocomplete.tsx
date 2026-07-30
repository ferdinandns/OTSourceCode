import { useState, useEffect, useRef, useCallback } from "react"
import { API_BASE } from "../config"

interface MasterItem {
  id: number
  kodeItem: string
  namaMaterial: string
  manufacture: string | null
}

interface ItemAutocompleteProps {
  kodeItemValue: string
  namaMaterialValue: string
  manufactureValue: string
  onKodeItemChange: (value: string) => void
  onNamaMaterialChange: (value: string) => void
  onManufactureChange: (value: string) => void
  onNewItemDetected?: (kodeItem: string, namaMaterial: string, manufacture: string, isManufactureOnly?: boolean) => void
  disabled?: boolean
  apiEndpoint?: string
}

export default function ItemAutocomplete({
  kodeItemValue, namaMaterialValue, manufactureValue,
  onKodeItemChange, onNamaMaterialChange, onManufactureChange,
  onNewItemDetected,
  disabled = false,
  apiEndpoint = `${API_BASE}/master-items`,
}: ItemAutocompleteProps) {
  const [masterItems, setMasterItems] = useState<MasterItem[]>([])
  const [kodeItemFiltered, setKodeItemFiltered] = useState<MasterItem[]>([])
  const [namaMaterialFiltered, setNamaMaterialFiltered] = useState<MasterItem[]>([])
  const [manufactureFiltered, setManufactureFiltered] = useState<string[]>([])

  const [showKodeDropdown, setShowKodeDropdown] = useState(false)
  const [showNamaDropdown, setShowNamaDropdown] = useState(false)
  const [showManufactureDropdown, setShowManufactureDropdown] = useState(false)

  const [loading, setLoading] = useState(false)

  const kodeIsFocused = useRef(false)
  const namaIsFocused = useRef(false)
  const manufactureIsFocused = useRef(false)

  const kodeRef = useRef<HTMLDivElement>(null)
  const namaRef = useRef<HTMLDivElement>(null)
  const manufactureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchMasterItems = async () => {
      try {
        setLoading(true)
        const response = await fetch(apiEndpoint)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        setMasterItems(data || [])
      } catch (error) {
        console.error(" Error fetching master items:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchMasterItems()
  }, [apiEndpoint])

  const checkAndNotifyNewItem = useCallback((kode: string, nama: string, mfr: string) => {
    if (!kode || !nama || !onNewItemDetected) return

    const matchByKode = masterItems.find(
      item => item.kodeItem.toLowerCase() === kode.toLowerCase()
    )

    if (!matchByKode) {
      onNewItemDetected(kode, nama, mfr)
      return
    }

    if (mfr && mfr.trim() !== "") {
      const mfrExists = masterItems.some(
        item =>
          item.kodeItem.toLowerCase() === kode.toLowerCase() &&
          item.manufacture &&
          item.manufacture.toLowerCase() === mfr.toLowerCase()
      )
      if (!mfrExists) {
        onNewItemDetected(kode, nama, mfr, true)
      }
    }
  }, [masterItems, onNewItemDetected])

  useEffect(() => {
    if (!kodeItemValue) { setKodeItemFiltered([]); setShowKodeDropdown(false); return }
    const searchLower = kodeItemValue.toLowerCase()
    const matched = masterItems.filter(item => item.kodeItem.toLowerCase().includes(searchLower))
    const seen = new Set<string>()
    const filtered = matched.filter(item => {
      const key = `${item.kodeItem}||${item.namaMaterial}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setKodeItemFiltered(filtered)
    if (kodeIsFocused.current) setShowKodeDropdown(filtered.length > 0)
  }, [kodeItemValue, masterItems])

  useEffect(() => {
    if (!namaMaterialValue) { setNamaMaterialFiltered([]); setShowNamaDropdown(false); return }
    const searchLower = namaMaterialValue.toLowerCase()
    const matched = masterItems.filter(item => item.namaMaterial.toLowerCase().includes(searchLower))
    const seen = new Set<string>()
    const filtered = matched.filter(item => {
      const key = `${item.kodeItem}||${item.namaMaterial}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    setNamaMaterialFiltered(filtered)
    if (namaIsFocused.current) setShowNamaDropdown(filtered.length > 0)
  }, [namaMaterialValue, masterItems])

  useEffect(() => {
    if (!manufactureValue) { setManufactureFiltered([]); setShowManufactureDropdown(false); return }
    const searchLower = manufactureValue.toLowerCase()
    const unique = [...new Set(
      masterItems.map(item => item.manufacture)
        .filter((m): m is string => m !== null && m !== undefined && m.toLowerCase().includes(searchLower))
    )]
    setManufactureFiltered(unique)
    if (manufactureIsFocused.current) setShowManufactureDropdown(unique.length > 0)
  }, [manufactureValue, masterItems])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (kodeRef.current && !kodeRef.current.contains(event.target as Node)) setShowKodeDropdown(false)
      if (namaRef.current && !namaRef.current.contains(event.target as Node)) setShowNamaDropdown(false)
      if (manufactureRef.current && !manufactureRef.current.contains(event.target as Node)) setShowManufactureDropdown(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelectKodeItem = (item: MasterItem) => {
    kodeIsFocused.current = false
    namaIsFocused.current = false
    onKodeItemChange(item.kodeItem)
    onNamaMaterialChange(item.namaMaterial)
    setShowKodeDropdown(false)
    setShowNamaDropdown(false)
    setTimeout(() => checkAndNotifyNewItem(item.kodeItem, item.namaMaterial, manufactureValue), 300)
  }

  const handleSelectNamaMaterial = (item: MasterItem) => {
    kodeIsFocused.current = false
    namaIsFocused.current = false
    onKodeItemChange(item.kodeItem)
    onNamaMaterialChange(item.namaMaterial)
    setShowKodeDropdown(false)
    setShowNamaDropdown(false)
    setTimeout(() => checkAndNotifyNewItem(item.kodeItem, item.namaMaterial, manufactureValue), 300)
  }

  const handleSelectManufacture = (manufacture: string) => {
    manufactureIsFocused.current = false
    onManufactureChange(manufacture)
    setShowManufactureDropdown(false)
    setTimeout(() => checkAndNotifyNewItem(kodeItemValue, namaMaterialValue, manufacture), 200)
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#2e3192] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
  const dropdownClass = "absolute z-[9999] w-full mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"
  const dropdownItemClass = "px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer border-b border-gray-100 dark:border-neutral-700 last:border-b-0 transition-colors"

  return (
    <div className="space-y-3">
      <div ref={kodeRef} className="relative">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Kode Item</label>
        <input
          id="kode-item" name="kodeItem"
          type="text" value={kodeItemValue}
          onChange={(e) => { onKodeItemChange(e.target.value) }}
          onFocus={() => { kodeIsFocused.current = true; if (kodeItemFiltered.length > 0) setShowKodeDropdown(true) }}
          onBlur={() => {
            kodeIsFocused.current = false
            setTimeout(() => checkAndNotifyNewItem(kodeItemValue, namaMaterialValue, manufactureValue), 200)
          }}
          disabled={disabled || loading}
          placeholder="Ketik kode item..."
          autoComplete="off"
          className={inputClass}
        />
        {showKodeDropdown && !disabled && (
          <div className={dropdownClass}>
            {kodeItemFiltered.map((item) => (
              <div key={item.id} onMouseDown={() => handleSelectKodeItem(item)} className={dropdownItemClass}>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.kodeItem}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.namaMaterial}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div ref={namaRef} className="relative">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Nama Material</label>
        <input
          id="nama-material" name="namaMaterial"
          type="text" value={namaMaterialValue}
          onChange={(e) => { onNamaMaterialChange(e.target.value) }}
          onFocus={() => { namaIsFocused.current = true; if (namaMaterialFiltered.length > 0) setShowNamaDropdown(true) }}
          onBlur={() => {
            namaIsFocused.current = false
            setTimeout(() => checkAndNotifyNewItem(kodeItemValue, namaMaterialValue, manufactureValue), 200)
          }}
          disabled={disabled || loading}
          placeholder="Ketik nama material..."
          autoComplete="off"
          className={inputClass}
        />
        {showNamaDropdown && !disabled && (
          <div className={dropdownClass}>
            {namaMaterialFiltered.map((item) => (
              <div key={item.id} onMouseDown={() => handleSelectNamaMaterial(item)} className={dropdownItemClass}>
                <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{item.namaMaterial}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{item.kodeItem}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div ref={manufactureRef} className="relative">
        <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Manufacture</label>
        <input
          id="manufacture" name="manufacture"
          type="text" value={manufactureValue}
          onChange={(e) => { onManufactureChange(e.target.value) }}
          onFocus={() => { manufactureIsFocused.current = true; if (manufactureFiltered.length > 0) setShowManufactureDropdown(true) }}
          onBlur={() => {
            manufactureIsFocused.current = false
            setTimeout(() => checkAndNotifyNewItem(kodeItemValue, namaMaterialValue, manufactureValue), 200)
          }}
          disabled={disabled || loading}
          placeholder="Ketik manufacture..."
          autoComplete="off"
          className={inputClass}
        />
        {showManufactureDropdown && !disabled && (
          <div className={dropdownClass}>
            {manufactureFiltered.map((manufacture, idx) => (
              <div key={idx} onMouseDown={() => handleSelectManufacture(manufacture)} className={dropdownItemClass}>
                <div className="text-sm font-medium text-gray-700 dark:text-gray-200">{manufacture}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading && (
        <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-1">⏳ Memuat data master items...</div>
      )}
    </div>
  )
}