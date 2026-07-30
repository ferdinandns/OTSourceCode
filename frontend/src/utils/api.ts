import { API_BASE } from "../config"

const API_BASE_URL = API_BASE
export const fetchDiversifikasi = async (site?: string) => {
  const url = site ? `${API_BASE_URL}/diversifikasi?site=${site}` : `${API_BASE_URL}/diversifikasi`
  const response = await fetch(url)
  if (!response.ok) throw new Error("Failed to fetch")
  return response.json()
}

export const createDiversifikasi = async (data: unknown) => {
  const response = await fetch(`${API_BASE_URL}/diversifikasi`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error("Failed to create")
  return response.json()
}

export const updateDiversifikasi = async (id: number, data: unknown) => {
  const response = await fetch(`${API_BASE_URL}/diversifikasi/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  })
  if (!response.ok) throw new Error("Failed to update")
  return response.json()
}

export const deleteDiversifikasi = async (id: number) => {
  const response = await fetch(`${API_BASE_URL}/diversifikasi/${id}`, {
    method: "DELETE"
  })
  if (!response.ok) throw new Error("Failed to delete")
  return response.json()
}