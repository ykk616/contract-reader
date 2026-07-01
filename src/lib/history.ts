// 把每份合同的总结存到浏览器（localStorage）。
// 用户下次打开还能看，不用重跑 AI。

export type HistoryItem = {
  id: string; // 唯一 ID
  fileName: string;
  summary: string;
  createdAt: number; // 时间戳
  userQuestion?: string;
};

const KEY = "contract_reader_history";
const MAX_ITEMS = 50;

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveToHistory(item: Omit<HistoryItem, "id" | "createdAt">): HistoryItem {
  const newItem: HistoryItem = {
    ...item,
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    createdAt: Date.now(),
  };
  const all = loadHistory();
  all.unshift(newItem);
  // 限制最多 50 条
  const trimmed = all.slice(0, MAX_ITEMS);
  localStorage.setItem(KEY, JSON.stringify(trimmed));
  return newItem;
}

export function deleteFromHistory(id: string): void {
  const all = loadHistory().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}
