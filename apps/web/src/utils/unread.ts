const READ_KEY = 'ann_read_ids'
const HIDE_READ_KEY = 'ann_hide_read'

function getStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function setStored<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore
  }
}

export function getReadIds(): Set<number> {
  const arr = getStored<number[]>(READ_KEY, [])
  return new Set(arr)
}

export function isRead(id: number): boolean {
  return getReadIds().has(id)
}

export function markRead(id: number) {
  const set = getReadIds()
  if (!set.has(id)) {
    set.add(id)
    setStored(READ_KEY, Array.from(set))
  }
}

export function markUnread(id: number) {
  const set = getReadIds()
  if (set.has(id)) {
    set.delete(id)
    setStored(READ_KEY, Array.from(set))
  }
}

export function clearAllRead() {
  setStored(READ_KEY, [])
}

export function getHideRead(): boolean {
  return Boolean(getStored<boolean>(HIDE_READ_KEY, false))
}

export function setHideRead(value: boolean) {
  setStored(HIDE_READ_KEY, value)
}


