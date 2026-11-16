/**
 * Vercel Blob (private store) persistence. Credentials come from the store connected to the
 * project (BLOB_READ_WRITE_TOKEN, or OIDC + BLOB_STORE_ID) — nothing to configure in code.
 *
 *   data/cases.json             current collection (conditional writes via ETag)
 *   data/history/cases-<time>   the version before each save
 *   images/<uuid>.<ext>         uploaded screenshots (immutable)
 */
import { BlobPreconditionFailedError, get, list, del, put } from "@vercel/blob";
import { ConflictError, type CaseRepository, type StoredCases } from "./handlers.js";

const CASES_PATH = "data/cases.json";
const HISTORY_PREFIX = "data/history/";
const KEEP_HISTORY = 50;

export const blobRepository: CaseRepository = {
  async readCases(fresh) {
    const result = await get(CASES_PATH, { access: "private", useCache: !fresh });
    if (!result || result.statusCode !== 200) return null;
    return { text: await new Response(result.stream).text(), etag: result.blob.etag };
  },

  async writeCases(text, expectedEtag) {
    try {
      const result = await put(CASES_PATH, text, {
        access: "private",
        contentType: "application/json; charset=utf-8",
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ...(expectedEtag ? { ifMatch: expectedEtag } : { allowOverwrite: false }),
      });
      return result.etag;
    } catch (error) {
      // ifMatch lost the race, or (first save) someone else created the file first.
      if (error instanceof BlobPreconditionFailedError || (!expectedEtag && error instanceof Error && /already exists/i.test(error.message))) {
        throw new ConflictError();
      }
      throw error;
    }
  },

  async backupCases(previous: StoredCases) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    await put(`${HISTORY_PREFIX}cases-${stamp}.json`, previous.text, { access: "private", contentType: "application/json; charset=utf-8", addRandomSuffix: true });
    const { blobs } = await list({ prefix: HISTORY_PREFIX, limit: 1000 });
    const stale = blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime()).slice(KEEP_HISTORY);
    if (stale.length) await del(stale.map((blob) => blob.url));
  },

  async putImage(name, bytes, contentType) {
    await put(`images/${name}`, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: false, cacheControlMaxAge: 31536000 });
  },

  async getImage(name) {
    const result = await get(`images/${name}`, { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, contentType: result.blob.contentType };
  },
};
