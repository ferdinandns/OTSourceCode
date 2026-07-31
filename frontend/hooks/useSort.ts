import { useState } from "react";

export function useSort(defaultSortBy: string = "name", defaultSortOrder: "asc" | "desc" = "asc") {
  const [sortBy, setSortBy] = useState<string>(defaultSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(defaultSortOrder);

  const handleSort = (columnKey: string, onSortCallback?: () => void) => {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(columnKey);
      setSortOrder("asc");
    }

    // Jika ada fungsi tambahan yang ingin dijalankan saat klik (misal: setPage(1))
    if (onSortCallback) {
      onSortCallback();
    }
  };

  return { sortBy, sortOrder, handleSort };
}