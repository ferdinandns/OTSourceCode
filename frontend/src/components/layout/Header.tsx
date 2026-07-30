import { Sun, Moon } from "lucide-react"
import { useAuth } from "../../hooks/useAuth"
import { useTheme } from "../../hooks/useTheme"

export default function Header() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <header
      className={`h-16 flex items-center justify-end px-4 sm:px-6 relative
      ${theme === "dark" ? "bg-gray-900 text-white" : "bg-[#2e3192] text-white"}`}
    >
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={toggleTheme}
          className="hover:text-[#80bc00] transition flex-shrink-0"
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <p className="font-semibold truncate sm:whitespace-normal">
          {user?.name} ({user?.division})
        </p>
      </div>
    </header>
  )
}