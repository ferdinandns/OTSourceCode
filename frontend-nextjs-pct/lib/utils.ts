import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Fungsi ini fungsinya menggabungkan class Tailwind dan memastikan tidak ada class yang konflik (misal: bg-red-500 dan bg-blue-500)
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}