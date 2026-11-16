/**
 * Who may edit, on Vercel.
 *
 * Every deployment is reachable on two kinds of address:
 *   • the public production domain (e.g. supportfolio.vercel.app) — open to everyone, read-only;
 *   • its generated deployment URL (VERCEL_URL, e.g. supportfolio-a1b2c3-you.vercel.app) — which
 *     the project's Standard Deployment Protection keeps behind a Vercel login.
 * Editing is allowed only on the generated URL(s), and only after confirming that protection is
 * really switched on: we request our own URL without credentials and expect to be turned away.
 * If that ever succeeds (protection disabled), editing shuts off rather than opening up.
 */
import { PROBE_BODY, type Access } from "./handlers.js";

const PROBE_TTL_MS = 5 * 60 * 1000;
let probeCache: { checkedAt: number; protectedDeployment: boolean } | null = null;

async function deploymentIsProtected(deploymentHost: string): Promise<boolean> {
  if (probeCache && Date.now() - probeCache.checkedAt < PROBE_TTL_MS) return probeCache.protectedDeployment;
  let protectedDeployment = false;
  try {
    const response = await fetch(`https://${deploymentHost}/api/session?probe=1`, {
      redirect: "manual",
      headers: { "User-Agent": "supportfolio-protection-check" },
      signal: AbortSignal.timeout(5000),
    });
    const body = response.status === 200 ? await response.json().catch(() => null) : null;
    // Reaching our own endpoint anonymously means nothing is guarding this address.
    protectedDeployment = !(body && typeof body === "object" && (body as typeof PROBE_BODY).probe === PROBE_BODY.probe);
  } catch {
    protectedDeployment = false; // Can't verify → fail closed.
  }
  probeCache = { checkedAt: Date.now(), protectedDeployment };
  return protectedDeployment;
}

const normalizeHost = (host: string | null | undefined) => (host ?? "").toLowerCase().replace(/:\d+$/, "");

export async function vercelAccess(request: Request): Promise<Access> {
  const environment = process.env.VERCEL_ENV;
  const deploymentHost = normalizeHost(process.env.VERCEL_URL);
  const branchHost = normalizeHost(process.env.VERCEL_BRANCH_URL);
  const host = normalizeHost(request.headers.get("host"));
  const base = { storage: "cloud" as const };

  // `vercel dev` on your own machine.
  if (environment === "development") return { ...base, canEdit: true, editUrl: null, notice: null };

  const onGeneratedUrl = Boolean(host) && (host === deploymentHost || host === branchHost);
  if (!onGeneratedUrl) {
    return { ...base, canEdit: false, editUrl: deploymentHost ? `https://${deploymentHost}` : null, notice: null };
  }
  if (!(await deploymentIsProtected(deploymentHost))) {
    return { ...base, canEdit: false, editUrl: null, notice: "Editing is switched off because Vercel Authentication isn't protecting this deployment. Turn on Deployment Protection (Standard) in the project settings." };
  }
  return { ...base, canEdit: true, editUrl: null, notice: null };
}
