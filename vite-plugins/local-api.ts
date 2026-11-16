/**
 * Serves the same /api/* contract as the Vercel Functions while you run `npm run dev`, backed by
 * files in .local-data/ instead of Vercel Blob. Local edits never touch the live site's data.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import { Readable } from "node:stream";
import type { Plugin } from "vite";
import { fileRepository } from "../server/fileRepository.js";
import { handleApi, isApiRoute, type ApiContext } from "../server/handlers.js";

function toWebRequest(req: IncomingMessage & { originalUrl?: string }): Request {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(", ") : value);
  }
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(`http://${req.headers.host ?? "localhost"}${req.originalUrl ?? req.url ?? "/"}`, {
    method: req.method,
    headers,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined,
    duplex: "half",
  } as RequestInit);
}

async function sendWebResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function localApiPlugin(): Plugin {
  return {
    name: "supportfolio-local-api",
    apply: "serve",
    configureServer(server) {
      const context: ApiContext = {
        repository: fileRepository(path.join(server.config.root, ".local-data")),
        access: async () => ({ canEdit: true, storage: "local", editUrl: null, notice: null }),
      };
      server.middlewares.use("/api", (req, res, next) => {
        const route = (req.url ?? "/").split("?")[0].replace(/^\/+|\/+$/g, "");
        if (!isApiRoute(route)) return next();
        handleApi(route, toWebRequest(req), context)
          .then((response) => sendWebResponse(res, response))
          .catch((error: unknown) => {
            server.config.logger.error(`[local-api] ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
            if (!res.headersSent) { res.statusCode = 500; res.end(); }
          });
      });
    },
  };
}
