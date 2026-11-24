/* Shared-data sync. Every browser/installed app keeps a local copy (works offline) and mirrors it to the
   Vel Groups server (server/sync-server.mjs): changes are pushed after you save, and everyone pulls every few seconds. */

export const SHARED_KEYS = ['products', 'services', 'company', 'settings', 'orders', 'enquiries', 'categories', 'proofs', 'vendors', 'vendorDocs', 'users'];

/* In the Claude artifact preview there is no server, but the page gets a shared database that every viewer sees. */
interface DbSnap { docs: { data(): Record<string, unknown> | undefined }[]; metadata: { fromCache: boolean } }
interface DbLike {
  doc(path: string): { set(d: Record<string, unknown>): Promise<void> };
  collection(path: string): { onSnapshot(next: (s: DbSnap) => void, err?: (e: unknown) => void): () => void };
}
const SENSITIVE_KEYS = ['proofs', 'vendorDocs'];
const CHUNK = 180000;
const sentEntries: Record<string, string> = {};
const remoteVal: Record<string, unknown> = {};
const chains: Record<string, Promise<void>> = {};
const seededKeys: Record<string, boolean> = {};

type Listener = { apply: (value: unknown) => void; current: () => unknown };

const listeners = new Map<string, Listener>();
const revs: Record<string, number> = {};
const pushTimers: Record<string, number> = {};
let ready = false;
let started = false;
let state: 'connecting' | 'online' | 'offline' | 'readonly' = 'connecting';
let dbMode: DbLike | null = null;
const statusSubs = new Set<() => void>();

const apiBase = (): string => ((window as unknown as { VEL_API_URL?: string }).VEL_API_URL ?? '/api').replace(/\/$/, '');
const ownerKey = (): string => {
  try { return window.localStorage.getItem('vel.v1.ownerKey') ?? ''; } catch { return ''; }
};
export const setOwnerKey = (k: string): void => {
  try { window.localStorage.setItem('vel.v1.ownerKey', k.trim()); } catch { /* ignore */ }
  void pull();
};
export const getOwnerKey = ownerKey;
export const syncState = (): typeof state => state;
export const subscribeSync = (fn: () => void): (() => void) => {
  statusSubs.add(fn);
  return () => statusSubs.delete(fn);
};
const setState = (s: typeof state) => {
  if (s !== state) {
    state = s;
    statusSubs.forEach((f) => f());
  }
};
const headers = (): Record<string, string> => {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  const k = ownerKey();
  if (k) h['x-owner-key'] = k;
  return h;
};

export async function pull(): Promise<void> {
  try {
    const r = await fetch(apiBase() + '/state', { headers: headers(), cache: 'no-store' });
    if (!r.ok) throw new Error(String(r.status));
    const { data } = (await r.json()) as { data: Record<string, { rev: number; value: unknown }> };
    setState('online');
    for (const [key, l] of listeners) {
      const s = data[key];
      if (!s) {
        // The server has never seen this table: this device seeds it (not for owner-only tables the server hid from us).
        if (!ready && key !== 'proofs' && key !== 'vendorDocs') await push(key, l.current());
        continue;
      }
      if ((revs[key] ?? -1) !== s.rev) {
        revs[key] = s.rev;
        l.apply(s.value);
      }
    }
    ready = true;
  } catch {
    setState('offline');
  }
}

type Rec = { id?: string; updatedAt?: string };
/** Merge two versions of a list of records by id so a simultaneous save (say a new order and an owner assignment) keeps both. */
function mergeLists(server: unknown, local: unknown): unknown {
  if (!Array.isArray(server) || !Array.isArray(local)) return server;
  if (![...server, ...local].every((x) => x && typeof x === 'object' && 'id' in (x as Rec))) return server;
  const byId = new Map<string, Rec>(server.map((x: Rec) => [String(x.id), x]));
  for (const l of local as Rec[]) {
    const s = byId.get(String(l.id));
    if (!s || !(s.updatedAt && l.updatedAt ? s.updatedAt > l.updatedAt : false)) byId.set(String(l.id), l);
  }
  return [...byId.values()];
}

async function push(key: string, value: unknown, retry = 0): Promise<void> {
  try {
    const r = await fetch(apiBase() + '/state/' + key, { method: 'PUT', headers: headers(), body: JSON.stringify({ value, baseRev: revs[key] ?? 0 }) });
    if (r.status === 409) {
      // Someone else saved first: take their version so nothing is silently overwritten, then the person can redo the change.
      const cur = (await r.json()) as { rev: number; value: unknown };
      revs[key] = cur.rev;
      const merged = mergeLists(cur.value, value);
      listeners.get(key)?.apply(merged);
      if (merged !== cur.value && retry < 2) await push(key, merged, retry + 1);
      return;
    }
    if (!r.ok) throw new Error(String(r.status));
    revs[key] = ((await r.json()) as { rev: number }).rev;
    setState('online');
  } catch {
    setState('offline');
  }
}

/** Called by the store whenever a shared table changes locally. */
export function schedulePush(key: string): void {
  if (!ready) return;
  window.clearTimeout(pushTimers[key]);
  pushTimers[key] = window.setTimeout(() => {
    const l = listeners.get(key);
    if (!l) return;
    if (dbMode) chains[key] = (chains[key] ?? Promise.resolve()).then(() => dbPush(key, l.current()));
    else void push(key, l.current());
  }, 350);
}

export function registerShared(key: string, l: Listener): () => void {
  listeners.set(key, l);
  if (!started) {
    started = true;
    void begin();
  }
  return () => listeners.delete(key);
}

async function begin(): Promise<void> {
  const c = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude;
  if (c && typeof c.use === 'function') {
    try {
      const d = (await c.use('db')) as DbLike | null;
      if (d) {
        dbMode = d;
        startDb(d);
        return;
      }
    } catch {
      /* fall through to the server */
    }
  }
  startHttp();
}

async function writeBlob(d: DbLike, col: string, name: string, text: string): Promise<number> {
  const rev = Date.now();
  const n = Math.max(1, Math.ceil(text.length / CHUNK));
  for (let i = 0; i < n; i++) await d.doc(`${col}/${name}~${i}`).set({ name, i, n, rev, s: text.slice(i * CHUNK, (i + 1) * CHUNK) });
  return rev;
}

async function dbPush(key: string, value: unknown): Promise<void> {
  if (!dbMode || SENSITIVE_KEYS.includes(key)) return;
  try {
    if (SENSITIVE_KEYS.includes(key)) {
      for (const [id, v] of Object.entries((value ?? {}) as Record<string, unknown>)) {
        const t = JSON.stringify(v);
        if (sentEntries[key + '~' + id] === t) continue;
        await writeBlob(dbMode, 'private', key + '~' + id, t);
        sentEntries[key + '~' + id] = t;
      }
    } else {
      const v = key === 'orders' ? mergeLists(remoteVal[key], value) : value;
      revs[key] = await writeBlob(dbMode, 'shared', key, JSON.stringify(v));
      remoteVal[key] = v;
    }
    setState('online');
  } catch {
    setState('readonly');
  }
}

function blobsOf(snap: DbSnap): Map<string, { rev: number; text: string }> {
  const by = new Map<string, Map<number, { n: number; parts: Map<number, string> }>>();
  for (const dd of snap.docs) {
    const x = dd.data() as { name?: string; i?: number; n?: number; rev?: number; s?: string } | undefined;
    if (!x || typeof x.name !== 'string' || typeof x.rev !== 'number') continue;
    const revs2 = by.get(x.name) ?? new Map();
    const e = revs2.get(x.rev) ?? { n: Number(x.n), parts: new Map<number, string>() };
    e.parts.set(Number(x.i), String(x.s ?? ''));
    revs2.set(x.rev, e);
    by.set(x.name, revs2);
  }
  const out = new Map<string, { rev: number; text: string }>();
  for (const [name, revs2] of by) {
    const best = [...revs2.keys()].sort((a, b) => b - a).find((r) => revs2.get(r)!.parts.size === revs2.get(r)!.n);
    if (best === undefined) continue;
    const e = revs2.get(best)!;
    out.set(name, { rev: best, text: Array.from({ length: e.n }, (_, i) => e.parts.get(i) ?? '').join('') });
  }
  return out;
}

function startDb(d: DbLike): void {
  const onShared = (snap: DbSnap) => {
    const blobs = blobsOf(snap);
    const definitive = !snap.metadata.fromCache;
    for (const [key, l] of listeners) {
      if (SENSITIVE_KEYS.includes(key)) continue;
      const b = blobs.get(key);
      if (!b) {
        if (definitive && !seededKeys[key]) {
          seededKeys[key] = true;
          chains[key] = (chains[key] ?? Promise.resolve()).then(() => dbPush(key, l.current()));
        }
        continue;
      }
      seededKeys[key] = true;
      if (revs[key] === b.rev) continue;
      try {
        remoteVal[key] = JSON.parse(b.text);
        revs[key] = b.rev;
        l.apply(remoteVal[key]);
      } catch {
        /* ignore a half-written copy */
      }
    }
    if (definitive) {
      ready = true;
      setState(state === 'readonly' ? 'readonly' : 'online');
    }
  };
  const onPrivate = (snap: DbSnap) => {
    const blobs = blobsOf(snap);
    for (const [key, l] of listeners) {
      if (!SENSITIVE_KEYS.includes(key)) continue;
      const map: Record<string, unknown> = {};
      for (const [name, b] of blobs) {
        if (!name.startsWith(key + '~')) continue;
        try {
          map[name.slice(key.length + 1)] = JSON.parse(b.text);
          sentEntries[name] = b.text;
        } catch {
          /* ignore */
        }
      }
      if (Object.keys(map).length) l.apply({ ...((l.current() as Record<string, unknown>) ?? {}), ...map });
    }
  };
  const fail = () => setState('offline');
  d.collection('shared').onSnapshot(onShared, fail);
  // Vendor documents and payment screenshots are deliberately NOT put in this shared database: every viewer could read them.
  void onPrivate;
  window.setTimeout(() => {
    if (state === 'connecting') setState('offline');
  }, 10000);
}

function startHttp(): void {
  {
    void pull();
    // Real-time: the server announces every save over a live stream, and this device fetches immediately.
    try {
      const es = new EventSource(apiBase() + '/events');
      es.onmessage = () => void pull();
      es.onerror = () => setState('offline');
    } catch {
      /* the periodic refresh below still works */
    }
    window.setInterval(() => void pull(), 8000);
    window.addEventListener('focus', () => void pull());
    window.addEventListener('online', () => void pull());
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void pull());
  }
}
