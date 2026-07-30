import { API_BASE } from "../config"

export interface UserData {
  id: number
  name: string
  email: string
  division: string
  passwordEncoded?: string
  created_at?: string
  updated_at?: string
}

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  passwordEncoded: string
  division: string
}

export interface UpdateUserPayload {
  name: string
  email: string
  password?: string
  passwordEncoded?: string
  division: string
}

export async function getUsers(token?: string | null): Promise<UserData[]> {
  const res = await fetch(`${API_BASE}/users`, {
    headers: {
      ...(token && { "Authorization": `Bearer ${token}` }),
    },
  })
  if (!res.ok) throw new Error("Gagal mengambil data users")
  return res.json()
}

export async function addUser(payload: CreateUserPayload, token?: string | null): Promise<UserData> {
  const res = await fetch(`${API_BASE}/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` }),
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Gagal menambah user")
  return data
}

export async function updateUser(id: number, payload: UpdateUserPayload, token?: string | null): Promise<UserData> {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` }),
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Gagal update user")
  return data
}

export async function deleteUser(id: number, token?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/users/${id}`, {
    method: "DELETE",
    headers: {
      ...(token && { "Authorization": `Bearer ${token}` }),
    },
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Gagal menghapus user")
}