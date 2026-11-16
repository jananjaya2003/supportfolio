import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { loadSeedCases, type TroubleshootingCase } from "./cases";

/**
 * Case data lives behind /api (Vercel Blob in production, .local-data/ under `npm run dev`).
 * The bundled cases.json is only the starting content: it's shown until the first save, and as
 * a read-only fallback if the API can't be reached.
 */

export interface EditorSession {
  canEdit: boolean;
  storage: "cloud" | "local";
  /** Public site only: the protected address where the owner signs in to edit. */
  editUrl: string | null;
  notice: string | null;
}

export class EditorApiError extends Error {
  constructor(message: string, readonly details: string[] = [], readonly status = 0) { super(message); }
}

const READ_ONLY: EditorSession = { canEdit: false, storage: "cloud", editUrl: null, notice: null };

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, { ...init, headers: { "X-Case-Editor": "1", ...init?.headers } });
  } catch {
    throw new EditorApiError("Couldn't reach the server. Check your connection and try again.");
  }
  const body = (await response.json().catch(() => ({}))) as { error?: string; details?: string[] } & T;
  if (!response.ok) throw new EditorApiError(body.error ?? `Request failed (${response.status}).`, body.details ?? [], response.status);
  return body;
}

export async function uploadCaseImage(dataUrl: string): Promise<string> {
  const blob = await (await fetch(dataUrl)).blob();
  const { src } = await api<{ src: string }>("images", { method: "POST", headers: { "Content-Type": blob.type }, body: blob });
  return src;
}

const byNumber = (a: TroubleshootingCase, b: TroubleshootingCase) => Number.parseInt(a.id, 10) - Number.parseInt(b.id, 10);

interface CaseStore {
  cases: TroubleshootingCase[];
  status: "loading" | "ready" | "offline";
  session: EditorSession;
  /** Adds the case, or replaces the one with the same id. Resolves once it's stored. */
  saveCase: (item: TroubleshootingCase) => Promise<void>;
  deleteCase: (id: string) => Promise<void>;
}

const CaseStoreContext = createContext<CaseStore | null>(null);

export function CaseStoreProvider({ children }: { children: ReactNode }) {
  const [cases, setCases] = useState<TroubleshootingCase[]>([]);
  const [status, setStatus] = useState<CaseStore["status"]>("loading");
  const [session, setSession] = useState<EditorSession>(READ_ONLY);
  // The version we last read or wrote; the server refuses a save if someone saved in between.
  const etag = useRef<string | null>(null);
  const latest = useRef(cases);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<EditorSession>("session").catch(() => READ_ONLY),
      api<{ cases: TroubleshootingCase[] | null; etag: string | null }>("cases"),
    ])
      .then(async ([nextSession, data]) => {
        // Nothing saved yet: start from the bundled cases; the first save stores them.
        const loaded = data.cases ?? (await loadSeedCases());
        if (cancelled) return;
        latest.current = loaded;
        etag.current = data.etag;
        setCases(loaded);
        setSession(nextSession);
        setStatus("ready");
      })
      .catch(async (error: unknown) => {
        console.warn("Case API unavailable; showing the bundled cases read-only.", error);
        const seed = await loadSeedCases();
        if (cancelled) return;
        latest.current = seed;
        setCases(seed);
        setStatus("offline");
      });
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (next: TroubleshootingCase[]) => {
    const result = await api<{ etag: string }>("cases", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cases: next, etag: etag.current }) });
    etag.current = result.etag;
    latest.current = next;
    setCases(next);
  }, []);

  const saveCase = useCallback(async (item: TroubleshootingCase) => {
    const current = latest.current;
    const exists = current.some((entry) => entry.id === item.id);
    await persist((exists ? current.map((entry) => (entry.id === item.id ? item : entry)) : [...current, item]).sort(byNumber));
  }, [persist]);

  const deleteCase = useCallback(async (id: string) => {
    await persist(latest.current.filter((entry) => entry.id !== id));
  }, [persist]);

  const value = useMemo(() => ({ cases, status, session, saveCase, deleteCase }), [cases, status, session, saveCase, deleteCase]);
  return <CaseStoreContext.Provider value={value}>{children}</CaseStoreContext.Provider>;
}

export function useCases(): CaseStore {
  const store = useContext(CaseStoreContext);
  if (!store) throw new Error("useCases must be used inside <CaseStoreProvider>.");
  return store;
}
