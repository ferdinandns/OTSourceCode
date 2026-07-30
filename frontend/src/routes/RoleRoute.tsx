import { Navigate } from "react-router-dom"
import { useAuth } from "../hooks/useAuth"
import type { Division } from "../context/auth-context"

interface RoleRouteProps {
  children: React.ReactNode
  allowedDivisions?: Division[]
}

export default function RoleRoute({
  children,
  allowedDivisions
}: RoleRouteProps) {
  const { user } = useAuth()
  if (!user) {
    return <Navigate to="/" />
  }
  if (allowedDivisions && !allowedDivisions.includes(user.division)) {
    return <Navigate to="/dashboard" />
  }
  return <>{children}</>
}
