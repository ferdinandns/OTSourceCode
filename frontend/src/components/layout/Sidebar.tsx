import { NavLink } from "react-router-dom"
import { LayoutDashboard, FlaskConical, Package, Users, LogOut, ChevronRight, ChevronLeft, Trash2 } from "lucide-react"
import { useAuth } from "../../hooks/useAuth"
import { useTheme } from "../../hooks/useTheme"
import { useState } from "react"

import LogoWhite from "../../assets/B7-logo-white.png"

const ActivityLogIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

export default function Sidebar() {
  const { logout, user } = useAuth()
  const { theme } = useTheme()
  const [isOpen, setIsOpen] = useState(true)

  const allMenu = [
    { name: "Dashboard", path: "/dashboard", icon: <LayoutDashboard size={22} />, roles: ["Admin", "CPro", "QC", "TS", "Andev"] },
    { name: "Diversifikasi RM", path: "/diversifikasirm", icon: <FlaskConical size={22} />, roles: ["Admin", "CPro", "QC", "TS", "Andev"] },
    { name: "Diversifikasi PM", path: "/diversifikasipm", icon: <Package size={22} />, roles: ["Admin", "CPro", "QC", "TS", "Andev"] },
    { name: "Users", path: "/user-management", icon: <Users size={22} />, roles: ["Admin"] },
    { name: "Log Aktivitas", path: "/activity-log", icon: <ActivityLogIcon />, roles: ["Admin"] },
    { name: "Recycle Bin", path: "/recycle-bin", icon: <Trash2 size={22} />, roles: ["Admin"] }
  ]

  const menu = allMenu.filter(item => item.roles.includes(user?.division || ""))

  return (
    <aside
      className={`
        ${isOpen ? "w-64" : "w-20"} 
        transition-all duration-300 ease-in-out flex flex-col h-screen
        ${theme === "dark" ? "bg-gray-900 text-white" : "bg-[#2e3192] text-white"}
        relative shadow-lg
      `}
    >
      <div className="relative border-b border-white/10">
        {isOpen ? (
          <div className="py-4 pl-8 pr-6 flex items-center justify-between overflow-hidden h-20">
            <img
              src={LogoWhite}
              alt="Logo"
              className="h-28 w-auto object-contain object-top"
            />
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex-shrink-0 text-white/80 hover:text-[#80bc00] transition-colors duration-200"
            >
              <ChevronLeft size={24} />
            </button>
          </div>
        ) : (
          <div className="py-5 px-3 flex items-center justify-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="w-full flex items-center justify-center px-3 py-3 text-white/90"
            >
              <ChevronRight size={22} />
            </button>
          </div>
        )}
      </div>

      <nav className={`flex-1 px-3 py-6 space-y-1 ${isOpen ? "overflow-y-auto" : "overflow-visible"}`}>
        {menu.map(item => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-4 px-4 py-3 rounded-lg transition-all duration-200
              group relative
              ${isActive 
                ? "bg-white/10 text-[#80bc00] font-medium shadow-sm" 
                : "text-white/90 hover:bg-white/5 hover:text-white"
              }
              ${!isOpen && "justify-center"}
              `
            }
          >
            {({ isActive }) => (
              <>
                <span className={`flex-shrink-0 ${isActive ? "text-[#80bc00]" : ""}`}>
                  {item.icon}
                </span>
                {isOpen && (
                  <span className="truncate text-[15px]">{item.name}</span>
                )}
                
                {!isOpen && (
                  <div className="absolute left-full ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg 
                    opacity-0 invisible group-hover:opacity-100 group-hover:visible
                    transition-all duration-200 whitespace-nowrap z-50 shadow-lg">
                    {item.name}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 
                      border-4 border-transparent border-r-gray-900"></div>
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <button
          onClick={logout}
          className="flex items-center justify-center gap-4 px-4 py-3 
            text-white/90 hover:text-red-500
            transition-colors duration-200 w-full"
        >
          <LogOut size={22} className="flex-shrink-0" />
          {isOpen && <span className="text-[15px]">Logout</span>}
        </button>
      </div>
    </aside>
  )
}