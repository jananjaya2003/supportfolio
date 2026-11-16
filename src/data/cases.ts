import { validateCases } from "./validateCase";

export type Difficulty = "Easy" | "Intermediate" | "Advanced";
export const difficulties: Difficulty[] = ["Easy", "Intermediate", "Advanced"];

export interface CaseImage {
  id: string;
  /** Served by the API, e.g. "/api/image?name=3f2a….webp". */
  src: string;
  caption: string;
  alt: string;
}

export interface TroubleshootingCase {
  id: string;
  title: string;
  category: string;
  /** Key into caseIconOptions (src/caseVisuals.ts). */
  iconName: string;
  emoji: string;
  difficulty: Difficulty;
  device: string;
  time: string;
  description: string;
  problem: string;
  symptoms: string[];
  causes: string[];
  steps: [string, string][];
  root: string;
  resolution: string;
  verification: string[];
  prevention: string[];
  tools: string[];
  skills: string[];
  tree: [string, string][];
  images: CaseImage[];
}

/**
 * The starting content. Live cases come from /api/cases; this file is only fetched (as its own
 * chunk) while the store is still empty or the API can't be reached. It's validated so a
 * hand-edited file fails loudly instead of rendering half a page.
 */
export async function loadSeedCases(): Promise<TroubleshootingCase[]> {
  const { default: data } = await import("./cases.json");
  const errors = validateCases(data);
  if (errors.length) throw new Error(`src/data/cases.json is invalid:\n${errors.slice(0, 10).join("\n")}`);
  // JSON imports type pairs as string[][]; the shape was checked just above.
  return data as unknown as TroubleshootingCase[];
}

/** Categories in their preferred display order; categories added in the editor are appended. */
export const baseCategories = [
  "Windows",
  "Microsoft 365",
  "Networking",
  "Printers",
  "Identity & Access",
  "Hardware & Devices",
  "Software & Apps",
];

export function orderedCategories(cases: TroubleshootingCase[]): string[] {
  const extra = [...new Set(cases.map((item) => item.category))].filter((category) => !baseCategories.includes(category)).sort();
  return [...baseCategories.filter((category) => cases.some((item) => item.category === category)), ...extra];
}

export function nextCaseId(cases: TroubleshootingCase[]): string {
  const max = cases.reduce((highest, item) => Math.max(highest, Number.parseInt(item.id, 10) || 0), 0);
  return String(max + 1).padStart(2, "0");
}

export function emptyCase(id: string): TroubleshootingCase {
  return {
    id,
    title: "",
    category: baseCategories[0],
    iconName: "Wrench",
    emoji: "🛠️",
    difficulty: "Intermediate",
    device: "",
    time: "",
    description: "",
    problem: "",
    symptoms: [""],
    causes: [""],
    steps: [["", ""]],
    root: "",
    resolution: "",
    verification: [""],
    prevention: [""],
    tools: [""],
    skills: [""],
    tree: [["", ""]],
    images: [],
  };
}
