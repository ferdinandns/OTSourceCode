import { createContext } from "react"

export type Division = "Admin" | "CPro" | "QC" | "TS" | "Andev"

export interface User {
  id: number
  name: string
  email: string
  division: Division
}

export interface AuthContextType {
  user: User | null
  accessToken: string | null
  login: (userData: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  setAccessToken: (token: string) => void
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)