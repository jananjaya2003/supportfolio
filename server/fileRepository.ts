/**
 * Local persistence for `npm run dev`: same contract as Vercel Blob, stored in .local-data/
 * (git-ignored). Lets you work on the site offline without touching the live data.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ConflictError, type CaseRepository } from "./handlers.js";

const KEEP_HISTORY = 30;
const etagOf = (text: string) => `"${createHash("sha1").update(text).digest("hex")}"`;

export function fileRepository(root: string): CaseRepository {
  const casesFile = path.join(root, "cases.json");
  const historyDir = path.join(root, "history");
  const imagesDir = path.join(root, "images");
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  };
  const readText = () => readFile(casesFile, "utf8").catch((error: NodeJS.ErrnoException) => { if (error.code === "ENOENT") return null; throw error; });

  return {
    async readCases() {
      const text = await readText();
      return text === null ? null : { text, etag: etagOf(text) };
    },
    writeCases(text, expectedEtag) {
      return exclusive(async () => {
        const current = await readText();
        if ((current === null ? null : etagOf(current)) !== expectedEtag) throw new ConflictError();
        await mkdir(root, { recursive: true });
        await writeFile(casesFile, text, "utf8");
        return etagOf(text);
      });
    },
    async backupCases(previous) {
      await mkdir(historyDir, { recursive: true });
      await writeFile(path.join(historyDir, `cases-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), previous.text, "utf8");
      const old = (await readdir(historyDir)).filter((name) => name.endsWith(".json")).sort().slice(0, -KEEP_HISTORY);
      await Promise.all(old.map((name) => rm(path.join(historyDir, name), { force: true })));
    },
    async putImage(name, bytes) {
      await mkdir(imagesDir, { recursive: true });
      await writeFile(path.join(imagesDir, name), bytes);
    },
    async getImage(name) {
      try { return { body: new Uint8Array(await readFile(path.join(imagesDir, name))), contentType: "application/octet-stream" }; }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
    },
  };
}
