/**
 * The case API, written against Web-standard Request/Response so the same code runs as
 * Vercel Functions (api/*.ts, backed by Vercel Blob) and inside `npm run dev` (vite-plugins/
 * local-api.ts, backed by files in .local-data/).
 *
 *   GET  /api/session        who may edit here, and where the editor lives
 *   GET  /api/cases          { cases, etag }   (cases: null until the first save)
 *   PUT  /api/cases          { cases, etag } → { etag }   409 if someone saved in between
 *   POST /api/images         raw image bytes → { src }
 *   GET  /api/image?name=…   the stored image
 */
import { randomUUID } from "node:crypto";
import { IMAGE_NAME, imageSrc, validateCases } from "../src/data/validateCase.js";

export interface StoredCases {
  text: string;
  etag: string;
}

export interface CaseRepository {
  /** `fresh` bypasses any read cache (used when the reader might write next). */
  readCases(fresh: boolean): Promise<StoredCases | null>;
  /** Writes only if the stored etag still equals `expectedEtag` (null = must not exist yet). Returns the new etag. */
  writeCases(text: string, expectedEtag: string | null): Promise<string>;
  /** Keeps a copy of the version about to be replaced. */
  backupCases(previous: StoredCases): Promise<void>;
  putImage(name: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getImage(name: string): Promise<{ body: ReadableStream<Uint8Array> | Uint8Array; contentType: string } | null>;
}

export interface Access {
  canEdit: boolean;
  /** "cloud" = Vercel Blob, "local" = files on this computer (npm run dev). */
  storage: "cloud" | "local";
  /** On the public site: the protected address where the owner can edit. */
  editUrl: string | null;
  /** Why editing is unavailable here, when that's worth telling the owner. */
  notice: string | null;
}

export interface ApiContext {
  repository: CaseRepository;
  access(request: Request): Promise<Access>;
}

/** Thrown by repositories when a conditional write loses the race. */
export class ConflictError extends Error {}

class HttpError extends Error {
  constructor(readonly status: number, message: string, readonly details?: string[]) { super(message); }
}

export const PROBE_BODY = { probe: "supportfolio" };
const MAX_CASES_BYTES = 2 * 1024 * 1024;
// Vercel Functions accept request bodies up to 4.5 MB.
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES: Record<string, { ext: string; sniff: (b: Uint8Array) => boolean }> = {
  "image/png": { ext: "png", sniff: (b) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, i) => b[i] === byte) },
  "image/jpeg": { ext: "jpg", sniff: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  "image/gif": { ext: "gif", sniff: (b) => String.fromCharCode(...b.subarray(0, 4)) === "GIF8" },
  "image/webp": { ext: "webp", sniff: (b) => String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP" },
};
const CONTENT_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

const json = (status: number, payload: unknown, cacheControl = "no-store") =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cacheControl } });

/**
 * Writes must come from this site's own pages: the custom header forces a CORS preflight for
 * any cross-origin caller (which then fails), and Origin / Sec-Fetch-Site are checked directly.
 */
function assertSameOrigin(request: Request) {
  const host = request.headers.get("host");
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const originOk = !origin || origin === `https://${host}` || origin === `http://${host}`;
  if (request.headers.get("x-case-editor") !== "1" || !originOk || (fetchSite && fetchSite !== "same-origin")) {
    throw new HttpError(403, "Editing requests must come from this site.");
  }
}

async function readLimited(request: Request, limit: number): Promise<Uint8Array> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > limit) throw new HttpError(413, "That upload is too large.");
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength > limit) throw new HttpError(413, "That upload is too large.");
  return bytes;
}

async function requireEditor(request: Request, context: ApiContext) {
  assertSameOrigin(request);
  const access = await context.access(request);
  if (!access.canEdit) throw new HttpError(403, access.notice ?? "Editing isn't available on this address.");
}

async function session(request: Request, context: ApiContext) {
  if (new URL(request.url).searchParams.has("probe")) return json(200, PROBE_BODY);
  return json(200, await context.access(request));
}

async function getCases(request: Request, context: ApiContext) {
  const access = await context.access(request);
  const stored = await context.repository.readCases(access.canEdit);
  // Visitors get a CDN-cached copy (fresh within a minute of a save); editors always read the latest.
  const cacheControl = access.canEdit ? "no-store" : "public, max-age=0, s-maxage=60, stale-while-revalidate=600";
  const body = stored ? `{"etag":${JSON.stringify(stored.etag)},"cases":${stored.text}}` : `{"etag":null,"cases":null}`;
  return new Response(body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cacheControl } });
}

async function putCases(request: Request, context: ApiContext) {
  await requireEditor(request, context);
  let payload: unknown;
  try { payload = JSON.parse(new TextDecoder().decode(await readLimited(request, MAX_CASES_BYTES))); }
  catch (error) { if (error instanceof HttpError) throw error; throw new HttpError(400, "Request body is not valid JSON."); }
  const { cases, etag } = (payload ?? {}) as { cases?: unknown; etag?: unknown };
  if (etag !== null && typeof etag !== "string") throw new HttpError(400, "Missing version information. Reload the page and try again.");
  const errors = validateCases(cases);
  if (errors.length) throw new HttpError(422, "Some case details are invalid.", errors);

  const current = await context.repository.readCases(true);
  if ((current?.etag ?? null) !== etag) throw new ConflictError();
  if (current) await context.repository.backupCases(current);
  const nextEtag = await context.repository.writeCases(JSON.stringify(cases, null, 2), current?.etag ?? null);
  return json(200, { etag: nextEtag });
}

async function postImage(request: Request, context: ApiContext) {
  await requireEditor(request, context);
  const contentType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const type = IMAGE_TYPES[contentType];
  if (!type) throw new HttpError(415, "Images must be PNG, JPEG, WebP, or GIF.");
  const bytes = await readLimited(request, MAX_IMAGE_BYTES);
  if (!bytes.byteLength) throw new HttpError(400, "The image is empty.");
  if (!type.sniff(bytes)) throw new HttpError(415, "The file content doesn't match its image type.");
  const name = `${randomUUID()}.${type.ext}`;
  await context.repository.putImage(name, bytes, contentType);
  return json(201, { src: imageSrc(name) });
}

async function getImage(request: Request, context: ApiContext) {
  const name = new URL(request.url).searchParams.get("name") ?? "";
  if (!IMAGE_NAME.test(name)) throw new HttpError(400, "Invalid image name.");
  const image = await context.repository.getImage(name);
  if (!image) throw new HttpError(404, "Image not found.");
  const contentType = CONTENT_TYPES[name.split(".").pop() ?? ""] ?? image.contentType;
  // Names are unique per upload, so the bytes never change: cache them everywhere, forever.
  return new Response(image.body as ConstructorParameters<typeof Response>[0], {
    status: 200,
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable", "X-Content-Type-Options": "nosniff" },
  });
}

type Route = "session" | "cases" | "images" | "image";

const routes: Record<Route, Partial<Record<string, (request: Request, context: ApiContext) => Promise<Response>>>> = {
  session: { GET: session },
  cases: { GET: getCases, PUT: putCases },
  images: { POST: postImage },
  image: { GET: getImage },
};

export async function handleApi(route: Route, request: Request, context: ApiContext): Promise<Response> {
  const handler = routes[route][request.method];
  if (!handler) return json(405, { error: "Method not allowed." });
  try {
    return await handler(request, context);
  } catch (error) {
    if (error instanceof HttpError) return json(error.status, { error: error.message, details: error.details });
    if (error instanceof ConflictError) {
      return json(409, { error: "These cases were changed somewhere else (another tab or device) after you opened them. Reload the page to get the latest version, then make your edit again." });
    }
    console.error(`[api/${route}]`, error);
    const action = request.method === "GET" ? "Loading" : "Saving";
    return json(500, { error: `${action} failed on the server. If this keeps happening, check that the project's Blob storage is connected.` });
  }
}

export const isApiRoute = (value: string): value is Route => value in routes;
