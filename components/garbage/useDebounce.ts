// components/garbage/useDebounce.ts
import { useEffect, useState } from "react";

/** หน่วงค่าไว้ก่อนยิง API — แนวเดียวกับฮุคใน pages/admin/manage-complaints.jsx */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
