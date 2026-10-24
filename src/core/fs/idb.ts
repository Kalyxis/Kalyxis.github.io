const DB_NAME = 'kalyxis'
const DB_VERSION = 1
export const NODES = 'nodes'
export const META = 'meta'

let dbPromise: Promise<IDBDatabase> | null = null

/** Opens (once) the IndexedDB database that backs the on-device workspace. */
export function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION)
    open.onupgradeneeded = () => {
      const db = open.result
      if (!db.objectStoreNames.contains(NODES)) {
        const nodes = db.createObjectStore(NODES, { keyPath: 'path' })
        nodes.createIndex('parent', 'parent', { unique: false })
      }
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META)
    }
    open.onsuccess = () => {
      const db = open.result
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    open.onerror = () => {
      dbPromise = null
      reject(open.error ?? new Error('Could not open local storage'))
    }
    open.onblocked = () => {
      dbPromise = null
      reject(new Error('Local storage is blocked by another tab'))
    }
  })
  return dbPromise
}

export function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Storage request failed'))
  })
}

export function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Storage transaction failed'))
    tx.onabort = () => reject(tx.error ?? new Error('Storage transaction aborted'))
  })
}

export async function metaGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb()
  return (await request(db.transaction(META, 'readonly').objectStore(META).get(key))) as T | undefined
}

export async function metaSet(key: string, value: unknown): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(META, 'readwrite')
  tx.objectStore(META).put(value, key)
  await transactionDone(tx)
}
