import { blobRepository } from "./blobRepository.js";
import type { ApiContext } from "./handlers.js";
import { vercelAccess } from "./vercelAccess.js";

export const vercelContext: ApiContext = { repository: blobRepository, access: vercelAccess };
