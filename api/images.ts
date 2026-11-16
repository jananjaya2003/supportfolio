import { handleApi } from "../server/handlers.js";
import { vercelContext } from "../server/vercelContext.js";

export default { fetch: (request: Request) => handleApi("images", request, vercelContext) };
