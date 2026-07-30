import { useState, useEffect, useRef } from "react"
import { API_BASE } from "../config"

interface MasterProduct {
  id: number
  kodeProduk: string
}

interface ProductAutocompleteProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  onNewProductDetected?: (kodeProduk: string) => void
  refreshKey?: number
}

export default function ProductAutocomplete({
  value,
  onChange,
  disabled = false,
  onNewProductDetected,
  refreshKey = 0,
}: ProductAutocompleteProps) {
  const [products, setProducts] = useState<MasterProduct[]>([])
  const [filtered, setFiltered] = useState<MasterProduct[]>([])
  const [showDrop, setShowDrop] = useState(false)
  const [loading, setLoading] = useState(false)

  const focused = useRef(false)
  const selectedFromDropdown = useRef(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true)
        const response = await fetch(`${API_BASE}/master-products`)
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = await response.json()
        setProducts(data || [])
      } catch (error) {
        console.error(" Error fetching master products:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [refreshKey]) 

  useEffect(() => {
    if (!value) {
      setFiltered([])
      setShowDrop(false)
      return
    }
    const searchLower = value.toLowerCase()
    const result = products.filter(item =>
      item.kodeProduk.toLowerCase().includes(searchLower)
    )
    setFiltered(result)
    if (focused.current) setShowDrop(result.length > 0)
  }, [value, products])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setShowDrop(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const checkNewProduct = (val: string) => {
    if (selectedFromDropdown.current) {
      selectedFromDropdown.current = false
      return
    }
    if (!val.trim() || !onNewProductDetected) return
    const exists = products.some(
      item => item.kodeProduk.toLowerCase() === val.toLowerCase()
    )
    if (!exists) {
      onNewProductDetected(val)
    }
  }

  const inputClass =
    "w-full px-3 py-2 text-sm border border-gray-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-gray-700 dark:text-gray-200 focus:outline-none focus:border-[#2e3192] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"

  const dropdownClass =
    "absolute z-[9999] w-full mt-1 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-xl max-h-60 overflow-y-auto"

  const dropdownItemClass =
    "px-3 py-2.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 cursor-pointer border-b border-gray-100 dark:border-neutral-700 last:border-b-0 transition-colors"

  return (
    <div ref={wrapRef} className="relative">
      <input
        id="kode-produk" name="kodeProduk"
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => {
          focused.current = true
          if (filtered.length > 0) setShowDrop(true)
        }}
        onBlur={() => {
          focused.current = false
          setTimeout(() => checkNewProduct(value), 200)
        }}
        disabled={disabled || loading}
        placeholder="Ketik kode produk..."
        autoComplete="off"
        className={inputClass}
      />

      {showDrop && !disabled && (
        <div className={dropdownClass}>
          {filtered.map(item => (
            <div
              key={item.id}
              onMouseDown={() => {
                selectedFromDropdown.current = true
                onChange(item.kodeProduk)
                setShowDrop(false)
              }}
              className={dropdownItemClass}
            >
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {item.kodeProduk}
              </div>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Memuat data master products...
        </div>
      )}
    </div>
  )
}