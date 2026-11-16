/**
 * Shared by the browser (editor form) and the server (Vercel Functions and the local dev API),
 * so it must stay free of DOM APIs and app imports.
 */

/** Stored image file names are generated server-side: `<uuid>.<ext>`. */
export const IMAGE_NAME = /^[a-z0-9-]{1,64}\.(?:webp|png|jpe?g|gif)$/;
/** Images are always served through the API, e.g. `/api/image?name=3f2a….webp`. */
export const CASE_IMAGE_SRC = /^\/api\/image\?name=[a-z0-9-]{1,64}\.(?:webp|png|jpe?g|gif)$/;
export const imageSrc = (name: string) => `/api/image?name=${name}`;
export const MAX_IMAGES_PER_CASE = 12;
const DIFFICULTIES = ["Easy", "Intermediate", "Advanced"];

type Errors = Record<string, string>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function text(errors: Errors, key: string, value: unknown, label: string, max: number, required = true) {
  if (typeof value !== "string") { errors[key] = `${label} is missing.`; return; }
  if (required && !value.trim()) errors[key] = `${label} is required.`;
  else if (value.length > max) errors[key] = `${label} must be ${max} characters or fewer.`;
}

function list(errors: Errors, key: string, value: unknown, label: string, min: number) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) { errors[key] = `${label} must be a list of text items.`; return; }
  if (value.some((item) => !item.trim())) errors[key] = `${label} contains an empty item.`;
  else if (value.some((item) => item.length > 500)) errors[key] = `Each ${label.toLowerCase()} item must be 500 characters or fewer.`;
  else if (value.length < min) errors[key] = `Add at least ${min === 1 ? "one item" : `${min} items`} to ${label.toLowerCase()}.`;
}

function pairs(errors: Errors, key: string, value: unknown, label: string, min: number) {
  if (!Array.isArray(value) || value.some((pair) => !Array.isArray(pair) || pair.length !== 2 || pair.some((part) => typeof part !== "string"))) {
    errors[key] = `${label} must be a list of pairs.`;
    return;
  }
  if (value.some(([a, b]: string[]) => !a.trim() || !b.trim())) errors[key] = `Every entry in ${label.toLowerCase()} needs both fields filled in.`;
  else if (value.some(([a, b]: string[]) => a.length > 200 || b.length > 3000)) errors[key] = `An entry in ${label.toLowerCase()} is too long.`;
  else if (value.length < min) errors[key] = `Add at least one entry to ${label.toLowerCase()}.`;
}

/** Field-level errors keyed by field name; empty object means valid. */
export function caseFieldErrors(candidate: unknown): Errors {
  const errors: Errors = {};
  if (!isRecord(candidate)) return { case: "Case must be an object." };
  const c = candidate;
  if (typeof c.id !== "string" || !/^\d{2,4}$/.test(c.id)) errors.id = "Case number must be 2–4 digits.";
  text(errors, "title", c.title, "Title", 120);
  text(errors, "category", c.category, "Category", 40);
  text(errors, "iconName", c.iconName, "Icon", 40);
  text(errors, "emoji", c.emoji, "Emoji", 16, false);
  if (typeof c.difficulty !== "string" || !DIFFICULTIES.includes(c.difficulty)) errors.difficulty = "Choose a difficulty.";
  text(errors, "device", c.device, "Device or system", 80);
  text(errors, "time", c.time, "Estimated time", 40);
  text(errors, "description", c.description, "Short description", 300);
  text(errors, "problem", c.problem, "Problem overview", 3000);
  text(errors, "root", c.root, "Root cause", 3000);
  text(errors, "resolution", c.resolution, "Final resolution", 3000);
  list(errors, "symptoms", c.symptoms, "Symptoms", 1);
  list(errors, "causes", c.causes, "Possible causes", 1);
  pairs(errors, "steps", c.steps, "Troubleshooting steps", 1);
  list(errors, "verification", c.verification, "Verification steps", 0);
  list(errors, "prevention", c.prevention, "Prevention tips", 0);
  list(errors, "tools", c.tools, "Tools used", 0);
  list(errors, "skills", c.skills, "Skills demonstrated", 0);
  pairs(errors, "tree", c.tree, "Decision tree", 0);

  if (!Array.isArray(c.images)) errors.images = "Images must be a list.";
  else if (c.images.length > MAX_IMAGES_PER_CASE) errors.images = `A case can have at most ${MAX_IMAGES_PER_CASE} images.`;
  else {
    const bad = c.images.find((image) => !isRecord(image)
      || typeof image.id !== "string" || !/^[a-z0-9-]{1,64}$/.test(image.id)
      || typeof image.src !== "string" || !CASE_IMAGE_SRC.test(image.src)
      || typeof image.caption !== "string" || image.caption.length > 200
      || typeof image.alt !== "string" || image.alt.length > 200);
    if (bad) errors.images = "An image entry is invalid (check its caption and alt text length).";
  }
  return errors;
}

/** Whole-collection check: every case valid and case numbers unique. Returns readable messages. */
export function validateCases(candidate: unknown): string[] {
  if (!Array.isArray(candidate)) return ["Cases must be a list."];
  const messages: string[] = [];
  const seen = new Set<string>();
  candidate.forEach((item, index) => {
    const label = isRecord(item) && typeof item.id === "string" ? `Case ${item.id}` : `Case #${index + 1}`;
    for (const message of Object.values(caseFieldErrors(item))) messages.push(`${label}: ${message}`);
    if (isRecord(item) && typeof item.id === "string") {
      if (seen.has(item.id)) messages.push(`${label}: duplicate case number.`);
      seen.add(item.id);
    }
  });
  return messages;
}
