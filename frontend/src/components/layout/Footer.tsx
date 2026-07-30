import { useTheme } from "../../hooks/useTheme"

export default function Footer() {
  const { theme } = useTheme()

  return (
    <footer
      className={`h-10 flex items-center justify-center px-4 text-white
        ${theme === "dark" ? "bg-gray-900" : "bg-[#2e3192]"}`}
    >
      <p className="text-xs text-center">
        © 2026 Technical Service Monitoring & Management System · Developed by{" "}
        <span style={{ color: "#54f542" }} className="font-semibold">Bintang Toedjoe</span>{" "}
        in Collaboration with{" "}
        <span style={{ color: "#ff4d4d" }} className="font-semibold">President University</span>{" "}
        (Alfina Hilma Zein)
      </p>
    </footer>
  )
}