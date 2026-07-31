// src/utils/formatTime.ts

export function formatLeadTime(minutes: number): string {
  // Jika lebih dari atau sama dengan 1440 menit (1 hari)
  if (minutes >= 1440) {
    return (minutes / 1440).toFixed(1) + " HARI";
  }
  // Jika di bawah 1 hari, tampilkan dalam jam
  return (minutes / 60).toFixed(1) + " JAM";
}

export function calculateDuration(dateString?: string): string {
  if (!dateString) return "-";
  const past = new Date(dateString).getTime();
  const now = new Date().getTime();
  const diffMs = now - past;
  
  if (diffMs <= 0) return "0 hari 0 jam";
  
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffHours / 24);
  const hours = diffHours % 24;
  
  return `${days} hari ${hours} jam`;
}