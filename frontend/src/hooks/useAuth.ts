import { useContext } from "react"
import { AuthContext } from "../context/auth-context"
import type { AuthContextType } from "../context/auth-context"

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider")
  }

  return context
}