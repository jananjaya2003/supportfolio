import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  FileText,
  GitBranch,
  ImagePlus,
  Info,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  Plus,
  Route,
  Save,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { CaseCard } from "../components/CaseCard";
import { caseIconOptions } from "../caseVisuals";
import { baseCategories, difficulties, emptyCase, nextCaseId, orderedCategories, type CaseImage, type TroubleshootingCase } from "../data/cases";
import { EditorApiError, uploadCaseImage, useCases } from "../data/caseStore";
import { MAX_IMAGES_PER_CASE, caseFieldErrors, imageSrc } from "../data/validateCase";
import { ACCEPT_ATTRIBUTE, altFromFileName, prepareImage } from "./imageTools";
import "./editor.css";

/* ---------------------------------------------------------------------------------------------
   Model
   ------------------------------------------------------------------------------------------- */

/** An image in the form: `src` once it's on disk, `dataUrl` while it's only in the browser. */
type DraftImage = { id: string; caption: string; alt: string; src?: string; dataUrl?: string };
type Draft = Omit<TroubleshootingCase, "images"> & { images: DraftImage[] };
type Pair = [string, string];
type Errors = Record<string, string>;

const SECTIONS: { id: string; label: string; fields: string[] }[] = [
  { id: "basics", label: "Basics", fields: ["title", "description", "category", "difficulty", "device", "time", "iconName", "emoji"] },
  { id: "images", label: "Screenshots & images", fields: ["images"] },
  { id: "problem", label: "Problem", fields: ["problem", "symptoms", "causes"] },
  { id: "flow", label: "Troubleshooting steps", fields: ["steps"] },
  { id: "outcome", label: "Outcome", fields: ["root", "resolution", "verification"] },
  { id: "knowledge", label: "Prevention & skills", fields: ["prevention", "tools", "skills"] },
  { id: "decisions", label: "Decision tree", fields: ["tree"] },
];
const FIELD_ORDER = SECTIONS.flatMap((section) => section.fields);
const EMOJI_SUGGESTIONS = ["🛠️", "💻", "🖥️", "🖨️", "📶", "🌐", "🔐", "🔑", "✉️", "📁", "⚠️", "🔄"];
// Stand-in path for images not uploaded yet, so the rest of the case can be validated first.
const PENDING_SRC = imageSrc("pending.webp");

const trimList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);
const trimPairs = (items: Pair[]) => items.map(([a, b]): Pair => [a.trim(), b.trim()]).filter(([a, b]) => a || b);

/** Trim text and drop blank rows so half-filled lists don't block saving. */
function normalize(draft: Draft): Draft {
  return {
    ...draft,
    title: draft.title.trim(),
    category: draft.category.trim(),
    emoji: draft.emoji.trim(),
    device: draft.device.trim(),
    time: draft.time.trim(),
    description: draft.description.trim(),
    problem: draft.problem.trim(),
    root: draft.root.trim(),
    resolution: draft.resolution.trim(),
    symptoms: trimList(draft.symptoms),
    causes: trimList(draft.causes),
    verification: trimList(draft.verification),
    prevention: trimList(draft.prevention),
    tools: trimList(draft.tools),
    skills: trimList(draft.skills),
    steps: trimPairs(draft.steps),
    tree: trimPairs(draft.tree),
    images: draft.images.map((image) => ({ ...image, caption: image.caption.trim(), alt: image.alt.trim() })),
  };
}

const readableIconName = (name: string) => name.replace(/([a-z])([A-Z])/g, "$1 $2");

function focusField(key: string) {
  const anchor = document.getElementById(`field-${key}`);
  if (!anchor) return;
  const target = anchor.matches("input, textarea, select") ? anchor : anchor.querySelector<HTMLElement>("input, textarea, select, button");
  anchor.scrollIntoView({ behavior: "smooth", block: "center" });
  target?.focus({ preventScroll: true });
}

/* ---------------------------------------------------------------------------------------------
   Route entry
   ------------------------------------------------------------------------------------------- */

export default function CaseEditorRoute() {
  const { caseId } = useParams();
  return <EditorGate key={caseId ?? "new"} caseId={caseId} />;
}

function EditorGate({ caseId }: { caseId?: string }) {
  const { cases } = useCases();
  // Resolve once on mount: after a delete the case disappears from the store, but the form
  // should stay put until the redirect happens rather than flash a "not found" message.
  const [initial] = useState<Draft | null>(() => {
    if (!caseId) return emptyCase(nextCaseId(cases));
    const existing = cases.find((item) => item.id === caseId);
    return existing ? structuredClone(existing) : null;
  });
  if (!initial) {
    return (
      <section className="not-found-page page-width">
        <div className="eyebrow"><span className="eyebrow-line" /> CASE EDITOR</div>
        <h1>Case {caseId} <span className="heading-accent">doesn't exist.</span></h1>
        <p>It may have been deleted. You can start a new case instead.</p>
        <div className="hero-actions"><Link className="button button-primary" to="/cases/new"><Plus size={14} /> New case</Link><Link className="text-link" to="/cases">Back to the case library</Link></div>
      </section>
    );
  }
  return <CaseEditorForm initial={initial} isNew={!caseId} />;
}

/* ---------------------------------------------------------------------------------------------
   Form
   ------------------------------------------------------------------------------------------- */

function CaseEditorForm({ initial, isNew }: { initial: Draft; isNew: boolean }) {
  const { cases, saveCase, deleteCase, session } = useCases();
  const navigate = useNavigate();
  const location = useLocation();
  const formRef = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ message: string; details: string[] } | null>(null);
  const [confirm, setConfirm] = useState<"delete" | "discard" | null>(null);
  const [imageBusy, setImageBusy] = useState(0);
  const [imageProblems, setImageProblems] = useState<string[]>([]);
  const knownCategories = useMemo(() => [...new Set([...baseCategories, ...orderedCategories(cases)])], [cases]);
  const [customCategory, setCustomCategory] = useState(() => !knownCategories.includes(initial.category));
  const exitPath = isNew ? "/cases" : `/cases/${initial.id}`;

  const update = useCallback(<K extends keyof Draft>(key: K, value: Draft[K] | ((previous: Draft[K]) => Draft[K])) => {
    setDraft((previous) => ({ ...previous, [key]: typeof value === "function" ? (value as (p: Draft[K]) => Draft[K])(previous[key]) : value }));
    setDirty(true);
    setErrors((previous) => {
      if (!(key in previous)) return previous;
      const next = { ...previous };
      delete next[key as string];
      return next;
    });
  }, []);

  // Image intake: shared by the file picker, drag & drop, and Ctrl+V paste.
  const reservedSlots = useRef(0);
  const imageCount = useRef(draft.images.length);
  imageCount.current = draft.images.length;
  const addImages = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const room = Math.max(0, MAX_IMAGES_PER_CASE - imageCount.current - reservedSlots.current);
    const accepted = files.slice(0, room);
    const problems = files.length > accepted.length ? [`A case can hold ${MAX_IMAGES_PER_CASE} images, so ${files.length - accepted.length} ${files.length - accepted.length === 1 ? "wasn't" : "weren't"} added.`] : [];
    reservedSlots.current += accepted.length;
    setImageBusy((count) => count + accepted.length);
    const results = await Promise.allSettled(accepted.map(prepareImage));
    reservedSlots.current -= accepted.length;
    setImageBusy((count) => count - accepted.length);
    const added: DraftImage[] = [];
    results.forEach((result, index) => {
      if (result.status === "fulfilled") added.push({ id: crypto.randomUUID(), caption: "", alt: altFromFileName(accepted[index].name), dataUrl: result.value.dataUrl });
      else problems.push(result.reason instanceof Error ? result.reason.message : "An image couldn't be added.");
    });
    if (added.length) update("images", (previous) => [...previous, ...added]);
    setImageProblems(problems);
  }, [update]);

  // Paste a screenshot anywhere on the page.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = [...(event.clipboardData?.files ?? [])].filter((file) => file.type.startsWith("image/"));
      if (!files.length) return;
      event.preventDefault();
      void addImages(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addImages]);

  // Ctrl/Cmd+S saves.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Warn before closing the tab or reloading with unsaved work.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Deep links such as /cases/04/edit#images land on that section.
  useEffect(() => {
    const target = location.hash.slice(1);
    if (target) requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: "start" }));
    // First render only: the in-page section nav scrolls by itself without touching the hash.
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving || imageBusy > 0) return;
    const clean = normalize(draft);
    const found = caseFieldErrors({ ...clean, images: clean.images.map(({ id, caption, alt }) => ({ id, caption, alt, src: PENDING_SRC })) });
    if (Object.keys(found).length) {
      setErrors(found);
      const count = Object.keys(found).length;
      setBanner({ message: `Fix ${count} highlighted ${count === 1 ? "field" : "fields"} to save this case.`, details: [] });
      focusField(FIELD_ORDER.find((key) => key in found) ?? Object.keys(found)[0]);
      return;
    }
    setErrors({});
    setBanner(null);
    setSaving(true);
    try {
      // A new case could collide with one created in another tab since this form opened.
      const id = isNew && cases.some((item) => item.id === clean.id) ? nextCaseId(cases) : clean.id;
      const images: CaseImage[] = [];
      for (const [index, image] of clean.images.entries()) {
        const src = image.src ?? (await uploadCaseImage(image.dataUrl ?? ""));
        images.push({ id: image.id, src, caption: image.caption, alt: image.alt || image.caption || `${clean.title}, screenshot ${index + 1}` });
      }
      // Keep uploaded paths in the draft so a retry after a failed save doesn't upload twice.
      setDraft((previous) => ({ ...previous, images: previous.images.map((image) => { const saved = images.find((entry) => entry.id === image.id); return saved ? { ...image, src: saved.src, dataUrl: undefined } : image; }) }));
      await saveCase({ ...clean, id, images });
      setDirty(false);
      navigate(`/cases/${id}`, { state: { flash: isNew ? `Case ${id} created` : "Changes saved" } });
    } catch (error) {
      setBanner({ message: error instanceof Error ? error.message : "Saving failed.", details: error instanceof EditorApiError ? error.details : [] });
      setSaving(false);
    }
  }

  async function handleDelete() {
    setConfirm(null);
    setSaving(true);
    try {
      await deleteCase(initial.id);
      setDirty(false);
      navigate("/cases", { state: { flash: `Case ${initial.id} deleted` } });
    } catch (error) {
      setBanner({ message: error instanceof Error ? error.message : "Deleting failed.", details: [] });
      setSaving(false);
    }
  }

  const leave = () => (dirty ? setConfirm("discard") : navigate(exitPath));
  const sectionHasError = (fields: string[]) => fields.some((field) => field in errors);
  const preview: TroubleshootingCase = {
    ...draft,
    title: draft.title.trim() || "Untitled case",
    description: draft.description.trim() || "A one-line summary of the issue appears here.",
    category: draft.category.trim() || "Category",
    device: draft.device.trim() || "Device",
    images: draft.images.map((image) => ({ ...image, src: image.src ?? "" })),
  };
  const titleCaseName = initial.title || "this case";

  return (
    <form ref={formRef} className="editor-page" onSubmit={handleSubmit} noValidate aria-labelledby="editor-title">
      <div className="page-width">
        <header className="editor-header">
          <button type="button" className="detail-back link-reset" onClick={leave}><ArrowLeft size={13} /> {isNew ? "Back to case library" : "Back to case"}</button>
          <div className="eyebrow"><span className="eyebrow-line" /> CASE EDITOR</div>
          <h1 id="editor-title">{isNew ? <>Add a new <span className="heading-accent">case</span></> : <>Edit <span className="heading-accent">case {initial.id}</span></>}</h1>
          <p>{isNew ? <>This will be published as <strong>case {draft.id}</strong>.</> : <>Editing <strong>{initial.title}</strong>.</>} Every field is required unless it's marked optional.</p>
        </header>

        {banner && (
          <div className="editor-banner" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <div><strong>{banner.message}</strong>{banner.details.length > 0 && <ul>{banner.details.slice(0, 8).map((detail) => <li key={detail}>{detail}</li>)}</ul>}</div>
          </div>
        )}

        <div className="editor-layout">
          <div className="editor-main">
            <EditorSection id="basics" icon={<FileText size={17} />} title="Case basics" description="What the case is called and how it appears in the library.">
              <div className="field-grid">
                <Field id="title" label="Title" error={errors.title} className="span-2" counter={<Counter value={draft.title} max={120} />}>
                  <input id="field-title" className="input" value={draft.title} onChange={(event) => update("title", event.target.value)} maxLength={120} placeholder="e.g. Outlook keeps asking for a password" aria-invalid={Boolean(errors.title)} autoFocus={isNew} />
                </Field>
                <Field id="description" label="Short description" hint="One sentence shown on the library card." error={errors.description} className="span-2" counter={<Counter value={draft.description} max={300} />}>
                  <textarea id="field-description" className="input" rows={2} value={draft.description} onChange={(event) => update("description", event.target.value)} maxLength={300} placeholder="What the user experiences, in one line." aria-invalid={Boolean(errors.description)} />
                </Field>
                <Field id="category" label="Category" error={errors.category}>
                  <div className="select-wrap">
                    <select id={customCategory ? undefined : "field-category"} className="input" value={customCategory ? "__new" : draft.category} onChange={(event) => {
                      if (event.target.value === "__new") { setCustomCategory(true); update("category", ""); }
                      else { setCustomCategory(false); update("category", event.target.value); }
                    }}>
                      {knownCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                      <option value="__new">＋ New category…</option>
                    </select>
                    <ChevronDown size={15} aria-hidden="true" />
                  </div>
                  {customCategory && <input id="field-category" className="input" value={draft.category} onChange={(event) => update("category", event.target.value)} maxLength={40} placeholder="Name the new category" aria-label="New category name" aria-invalid={Boolean(errors.category)} autoFocus />}
                </Field>
                <fieldset className="field" id="field-difficulty">
                  <legend>Difficulty</legend>
                  <div className="segmented">
                    {difficulties.map((level) => (
                      <label key={level} className={`segment${draft.difficulty === level ? " active" : ""}`}>
                        <input type="radio" className="visually-hidden" name="difficulty" value={level} checked={draft.difficulty === level} onChange={() => update("difficulty", level)} />
                        <span className={`difficulty-dot ${level.toLowerCase()}`} aria-hidden="true" />{level}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field id="device" label="Device or system" error={errors.device}>
                  <input id="field-device" className="input" value={draft.device} onChange={(event) => update("device", event.target.value)} maxLength={80} placeholder="e.g. Windows 11 laptop" aria-invalid={Boolean(errors.device)} />
                </Field>
                <Field id="time" label="Estimated time" error={errors.time}>
                  <input id="field-time" className="input" value={draft.time} onChange={(event) => update("time", event.target.value)} maxLength={40} placeholder="e.g. 15–30 min" aria-invalid={Boolean(errors.time)} />
                </Field>
                <fieldset className="field span-2" id="field-iconName">
                  <legend>Icon</legend>
                  <div className="icon-picker">
                    {Object.entries(caseIconOptions).map(([name, Icon]) => (
                      <label key={name} className={`icon-option${draft.iconName === name ? " selected" : ""}`} title={readableIconName(name)}>
                        <input type="radio" className="visually-hidden" name="case-icon" value={name} checked={draft.iconName === name} onChange={() => update("iconName", name)} />
                        <Icon size={17} aria-hidden="true" /><span className="visually-hidden">{readableIconName(name)}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field id="emoji" label="Badge emoji" optional hint="Shown as a small badge on the icon." error={errors.emoji} className="span-2">
                  <div className="emoji-row">
                    <input id="field-emoji" className="input emoji-input" value={draft.emoji} onChange={(event) => update("emoji", event.target.value)} maxLength={16} aria-label="Badge emoji" />
                    <div className="emoji-chips" role="group" aria-label="Suggested emoji">
                      {EMOJI_SUGGESTIONS.map((emoji) => <button key={emoji} type="button" className={draft.emoji === emoji ? "active" : ""} onClick={() => update("emoji", emoji)} aria-label={`Use ${emoji}`} aria-pressed={draft.emoji === emoji}>{emoji}</button>)}
                    </div>
                  </div>
                </Field>
              </div>
            </EditorSection>

            <ImagesSection
              images={draft.images}
              busy={imageBusy}
              problems={imageProblems}
              error={errors.images}
              onAdd={addImages}
              onChange={(images) => update("images", images)}
            />

            <EditorSection id="problem" icon={<ClipboardList size={17} />} title="The problem" description="What was reported and what might be behind it.">
              <Field id="problem" label="Problem overview" error={errors.problem} counter={<Counter value={draft.problem} max={3000} />}>
                <textarea id="field-problem" className="input" rows={3} value={draft.problem} onChange={(event) => update("problem", event.target.value)} maxLength={3000} placeholder="Describe the issue from the user's point of view." aria-invalid={Boolean(errors.problem)} />
              </Field>
              <ListEditor id="symptoms" label="Symptoms" items={draft.symptoms} onChange={(items) => update("symptoms", items)} placeholder="e.g. Messages stay in the Outbox" addLabel="Add symptom" error={errors.symptoms} />
              <ListEditor id="causes" label="Possible causes" items={draft.causes} onChange={(items) => update("causes", items)} placeholder="e.g. Expired sign-in token" addLabel="Add cause" error={errors.causes} />
            </EditorSection>

            <EditorSection id="flow" icon={<Route size={17} />} title="Troubleshooting steps" description="The diagnostic path, in order. Each step needs a short title and what you did.">
              <PairEditor id="steps" label="Troubleshooting steps" numbered items={draft.steps} onChange={(items) => update("steps", items)} firstLabel="Step title" secondLabel="What to do" firstPlaceholder="e.g. Confirm scope and service health" secondPlaceholder="Explain the check, what you look for, and any safety notes." addLabel="Add step" error={errors.steps} />
            </EditorSection>

            <EditorSection id="outcome" icon={<ListChecks size={17} />} title="Outcome" description="What was actually wrong, how it was fixed, and how you proved it.">
              <Field id="root" label="Root cause" error={errors.root}>
                <textarea id="field-root" className="input" rows={2} value={draft.root} onChange={(event) => update("root", event.target.value)} maxLength={3000} placeholder="The confirmed underlying cause." aria-invalid={Boolean(errors.root)} />
              </Field>
              <Field id="resolution" label="Final resolution" error={errors.resolution}>
                <textarea id="field-resolution" className="input" rows={2} value={draft.resolution} onChange={(event) => update("resolution", event.target.value)} maxLength={3000} placeholder="The fix that resolved it." aria-invalid={Boolean(errors.resolution)} />
              </Field>
              <ListEditor id="verification" label="Verification steps" optional items={draft.verification} onChange={(items) => update("verification", items)} placeholder="e.g. Send a test message" addLabel="Add verification step" error={errors.verification} />
            </EditorSection>

            <EditorSection id="knowledge" icon={<Lightbulb size={17} />} title="Prevention & skills" description="Optional lists. Empty ones are hidden on the case page.">
              <ListEditor id="prevention" label="Prevention tips" optional items={draft.prevention} onChange={(items) => update("prevention", items)} placeholder="e.g. Keep the client updated" addLabel="Add tip" error={errors.prevention} />
              <ListEditor id="tools" label="Tools used" optional items={draft.tools} onChange={(items) => update("tools", items)} placeholder="e.g. Event Viewer" addLabel="Add tool" error={errors.tools} />
              <ListEditor id="skills" label="Skills demonstrated" optional items={draft.skills} onChange={(items) => update("skills", items)} placeholder="e.g. Windows diagnostics" addLabel="Add skill" error={errors.skills} />
            </EditorSection>

            <EditorSection id="decisions" icon={<GitBranch size={17} />} title="Decision tree" description="Optional yes/no checkpoints shown as expandable questions.">
              <PairEditor id="tree" label="Decision tree" optional items={draft.tree} onChange={(items) => update("tree", items)} firstLabel="Question" secondLabel="Guidance" firstPlaceholder="e.g. Does the web version work?" secondPlaceholder="Yes: … No: …" addLabel="Add question" error={errors.tree} />
            </EditorSection>
          </div>

          <aside className="editor-aside" aria-label="Preview and navigation">
            <div>
              <p className="aside-label">Live card preview</p>
              <div className="preview-frame" aria-hidden="true"><CaseCard item={preview} preview /></div>
            </div>
            <nav className="section-nav" aria-label="Form sections">
              {SECTIONS.map((section) => (
                <a key={section.id} href={`#${section.id}`} onClick={(event) => { event.preventDefault(); document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                  {section.label}{sectionHasError(section.fields) && <span className="nav-error-dot" title="Has errors" />}
                </a>
              ))}
            </nav>
            <p className="aside-note"><Info size={15} aria-hidden="true" /><span>{session.storage === "local" ? <>Local mode: changes are saved on this computer in <code>.local-data/</code> and don't affect the live site.</> : <>Changes are saved to your Vercel Blob store and appear on the public site within about a minute.</>} <kbd>Ctrl</kbd>+<kbd>S</kbd> saves.</span></p>
          </aside>
        </div>
      </div>

      <div className="editor-actionbar">
        <div className="page-width actionbar-inner">
          <span className={`save-state${dirty ? " dirty" : ""}`} aria-live="polite">{saving ? "Saving…" : imageBusy > 0 ? "Processing images…" : dirty ? "Unsaved changes" : isNew ? "Not saved yet" : "No changes yet"}</span>
          <div className="actionbar-buttons">
            {!isNew && <button type="button" className="button button-ghost-danger" onClick={() => setConfirm("delete")} disabled={saving}><Trash2 size={14} /> <span className="hide-sm">Delete</span></button>}
            <button type="button" className="button button-secondary" onClick={leave} disabled={saving}>Cancel</button>
            <button type="submit" className="button button-primary" disabled={saving || imageBusy > 0}>{saving ? <LoaderCircle size={14} className="spin" /> : <Save size={14} />} {isNew ? "Create case" : "Save changes"}</button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "delete"}
        tone="danger"
        title={`Delete case ${initial.id}?`}
        confirmLabel="Delete case"
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      >
        “{titleCaseName}” will be removed from the library. The previous version of all cases is kept as a backup, so it can be restored if needed.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "discard"}
        tone="warning"
        title="Discard your changes?"
        confirmLabel="Discard changes"
        onConfirm={() => { setDirty(false); setConfirm(null); navigate(exitPath); }}
        onCancel={() => setConfirm(null)}
      >
        You have unsaved edits on this case. If you leave now they'll be lost.
      </ConfirmDialog>
    </form>
  );
}

/* ---------------------------------------------------------------------------------------------
   Building blocks
   ------------------------------------------------------------------------------------------- */

function EditorSection({ id, icon, title, description, aside, children }: { id: string; icon: ReactNode; title: string; description: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="editor-card" id={id} aria-labelledby={`${id}-title`}>
      <header className="editor-card-head">
        <span className="section-icon" aria-hidden="true">{icon}</span>
        <div><h2 id={`${id}-title`}>{title}</h2><p>{description}</p></div>
        {aside}
      </header>
      <div className="editor-card-body">{children}</div>
    </section>
  );
}

function Field({ id, label, hint, error, optional, counter, className, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; counter?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`field${error ? " has-error" : ""}${className ? ` ${className}` : ""}`}>
      <div className="field-label-row"><label htmlFor={`field-${id}`}>{label}{optional && <span className="optional">Optional</span>}</label>{counter}</div>
      {children}
      {error ? <p className="field-error"><TriangleAlert size={12} aria-hidden="true" />{error}</p> : hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

function Counter({ value, max }: { value: string; max: number }) {
  const ratio = value.length / max;
  if (ratio < 0.6) return null;
  return <span className={`counter${ratio >= 1 ? " over" : ratio >= 0.9 ? " near" : ""}`}>{value.length}/{max}</span>;
}

function RowActions({ label, index, count, onMove, onRemove }: { label: string; index: number; count: number; onMove: (delta: number) => void; onRemove: () => void }) {
  return (
    <div className="row-actions">
      <button type="button" className="icon-btn" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${label} up`} title="Move up"><ArrowUp size={14} /></button>
      <button type="button" className="icon-btn" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Move ${label} down`} title="Move down"><ArrowDown size={14} /></button>
      <button type="button" className="icon-btn danger" onClick={onRemove} aria-label={`Remove ${label}`} title="Remove"><Trash2 size={14} /></button>
    </div>
  );
}

const swap = <T,>(items: T[], index: number, delta: number) => {
  const target = index + delta;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};

/** Moves focus to a row after it's added or removed, once React has rendered it. */
function useRowFocus(selector: string) {
  const listRef = useRef<HTMLOListElement>(null);
  const pending = useRef<number | null>(null);
  useEffect(() => {
    if (pending.current === null) return;
    listRef.current?.querySelectorAll<HTMLElement>(selector)[pending.current]?.focus();
    pending.current = null;
  });
  return { listRef, focusRow: (index: number) => { pending.current = index; } };
}

function ListEditor({ id, label, items, onChange, placeholder, addLabel, error, optional }: { id: string; label: string; items: string[]; onChange: (items: string[]) => void; placeholder: string; addLabel: string; error?: string; optional?: boolean }) {
  const { listRef, focusRow } = useRowFocus(".list-row input");
  const insertAfter = (index: number) => { focusRow(index + 1); onChange([...items.slice(0, index + 1), "", ...items.slice(index + 1)]); };
  const remove = (index: number) => { focusRow(Math.max(0, index - 1)); onChange(items.filter((_, position) => position !== index)); };
  return (
    <fieldset className={`field list-field${error ? " has-error" : ""}`} id={`field-${id}`}>
      <legend>{label}{optional && <span className="optional">Optional</span>}</legend>
      {items.length > 0 && (
        <ol className="list-rows" ref={listRef}>
          {items.map((value, index) => (
            <li className="list-row" key={index}>
              <span className="row-number" aria-hidden="true">{index + 1}</span>
              <input
                className="input"
                value={value}
                maxLength={500}
                placeholder={placeholder}
                aria-label={`${label}, item ${index + 1}`}
                aria-invalid={Boolean(error) && !value.trim()}
                onChange={(event) => onChange(items.map((item, position) => (position === index ? event.target.value : item)))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); insertAfter(index); }
                  if (event.key === "Backspace" && !value && items.length > 1) { event.preventDefault(); remove(index); }
                }}
              />
              <RowActions label={`${label.toLowerCase()} ${index + 1}`} index={index} count={items.length} onMove={(delta) => onChange(swap(items, index, delta))} onRemove={() => remove(index)} />
            </li>
          ))}
        </ol>
      )}
      <div className="list-footer">
        <button type="button" className="add-row" onClick={() => insertAfter(items.length - 1)}><Plus size={14} /> {addLabel}</button>
        {items.length > 0 && <span className="field-hint">Press Enter for a new line.</span>}
      </div>
      {error && <p className="field-error"><TriangleAlert size={12} aria-hidden="true" />{error}</p>}
    </fieldset>
  );
}

function PairEditor({ id, label, items, onChange, firstLabel, secondLabel, firstPlaceholder, secondPlaceholder, addLabel, error, optional, numbered }: { id: string; label: string; items: Pair[]; onChange: (items: Pair[]) => void; firstLabel: string; secondLabel: string; firstPlaceholder: string; secondPlaceholder: string; addLabel: string; error?: string; optional?: boolean; numbered?: boolean }) {
  const { listRef, focusRow } = useRowFocus(".pair-head input");
  const set = (index: number, part: 0 | 1, value: string) => onChange(items.map((pair, position): Pair => (position === index ? (part === 0 ? [value, pair[1]] : [pair[0], value]) : pair)));
  return (
    <fieldset className={`field pair-field${error ? " has-error" : ""}`} id={`field-${id}`}>
      <legend className={optional ? undefined : "visually-hidden"}>{label}{optional && <span className="optional">Optional</span>}</legend>
      {items.length > 0 && (
        <ol className="pair-rows" ref={listRef}>
          {items.map(([first, second], index) => (
            <li className="pair-row" key={index}>
              <div className="pair-head">
                <span className="step-badge" aria-hidden="true">{numbered ? String(index + 1).padStart(2, "0") : "?"}</span>
                <input className="input" value={first} maxLength={200} placeholder={firstPlaceholder} aria-label={`${firstLabel} ${index + 1}`} aria-invalid={Boolean(error) && !first.trim()} onChange={(event) => set(index, 0, event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
                <RowActions label={`${firstLabel.toLowerCase()} ${index + 1}`} index={index} count={items.length} onMove={(delta) => onChange(swap(items, index, delta))} onRemove={() => { focusRow(Math.max(0, index - 1)); onChange(items.filter((_, position) => position !== index)); }} />
              </div>
              <textarea className="input" rows={2} value={second} maxLength={3000} placeholder={secondPlaceholder} aria-label={`${secondLabel} ${index + 1}`} aria-invalid={Boolean(error) && !second.trim()} onChange={(event) => set(index, 1, event.target.value)} />
            </li>
          ))}
        </ol>
      )}
      <button type="button" className="add-row" onClick={() => { focusRow(items.length); onChange([...items, ["", ""]]); }}><Plus size={14} /> {addLabel}</button>
      {error && <p className="field-error"><TriangleAlert size={12} aria-hidden="true" />{error}</p>}
    </fieldset>
  );
}

function ImagesSection({ images, busy, problems, error, onAdd, onChange }: { images: DraftImage[]; busy: number; problems: string[]; error?: string; onAdd: (files: File[]) => void; onChange: (images: DraftImage[]) => void }) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const full = images.length >= MAX_IMAGES_PER_CASE;
  const edit = (index: number, patch: Partial<DraftImage>) => onChange(images.map((image, position) => (position === index ? { ...image, ...patch } : image)));

  return (
    <EditorSection
      id="images"
      icon={<ImagePlus size={17} />}
      title="Screenshots & images"
      description="Error dialogs, settings screens, or before-and-after photos. They appear as a gallery on the case page."
      aside={<span className="count-pill">{images.length}/{MAX_IMAGES_PER_CASE}</span>}
    >
      <label
        id="field-images"
        className={`dropzone${dragging ? " dragging" : ""}${full ? " disabled" : ""}${error ? " has-error" : ""}`}
        onDragEnter={(event) => { event.preventDefault(); dragDepth.current += 1; setDragging(true); }}
        onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = full ? "none" : "copy"; }}
        onDragLeave={() => { dragDepth.current -= 1; if (dragDepth.current <= 0) setDragging(false); }}
        onDrop={(event) => { event.preventDefault(); dragDepth.current = 0; setDragging(false); if (!full) onAdd([...event.dataTransfer.files]); }}
      >
        <input type="file" className="visually-hidden" accept={ACCEPT_ATTRIBUTE} multiple disabled={full} onChange={(event) => { onAdd([...(event.target.files ?? [])]); event.target.value = ""; }} />
        <span className="dropzone-icon" aria-hidden="true"><ImagePlus size={20} /></span>
        <strong>{full ? "Image limit reached" : dragging ? "Drop to add images" : <>Drag images here or <span className="browse">browse files</span></>}</strong>
        <span className="dropzone-sub">You can also paste a screenshot with <kbd>Ctrl</kbd>+<kbd>V</kbd>.</span>
        <small>PNG, JPG, WebP, or GIF. Large images are resized to 1920px and saved as WebP (which also removes location data from photos); each must end up under 4 MB.</small>
      </label>

      {busy > 0 && <p className="image-status" role="status"><LoaderCircle size={15} className="spin" aria-hidden="true" /> Preparing {busy} {busy === 1 ? "image" : "images"}…</p>}
      {problems.length > 0 && <ul className="image-problems" role="alert">{problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}
      {error && <p className="field-error"><TriangleAlert size={12} aria-hidden="true" />{error}</p>}

      {images.length > 0 && (
        <ol className="image-tiles">
          {images.map((image, index) => (
            <li className="image-tile" key={image.id}>
              <div className="image-thumb">
                <img src={image.dataUrl ?? image.src} alt="" />
                <span className="image-order">{index + 1}</span>
                {image.dataUrl && <span className="image-new">Not saved yet</span>}
              </div>
              <div className="image-fields">
                <label className="mini-field">
                  <span>Caption <em>shown under the image</em></span>
                  <input className="input" value={image.caption} maxLength={200} placeholder="e.g. Outlook status bar showing “Disconnected”" onChange={(event) => edit(index, { caption: event.target.value })} />
                </label>
                <label className="mini-field">
                  <span>Alt text <em>read aloud by screen readers; the caption is used if empty</em></span>
                  <input className="input" value={image.alt} maxLength={200} placeholder="Describe what the image shows" onChange={(event) => edit(index, { alt: event.target.value })} />
                </label>
              </div>
              <RowActions label={`image ${index + 1}`} index={index} count={images.length} onMove={(delta) => onChange(swap(images, index, delta))} onRemove={() => onChange(images.filter((_, position) => position !== index))} />
            </li>
          ))}
        </ol>
      )}
    </EditorSection>
  );
}

function ConfirmDialog({ open, tone, title, confirmLabel, onConfirm, onCancel, children }: { open: boolean; tone: "danger" | "warning"; title: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="confirm-dialog" onClose={onCancel} onClick={(event) => { if (event.target === event.currentTarget) onCancel(); }} aria-labelledby={`${tone}-dialog-title`}>
      <div className="confirm-body">
        <span className={`confirm-icon ${tone}`} aria-hidden="true">{tone === "danger" ? <Trash2 size={19} /> : <TriangleAlert size={19} />}</span>
        <h2 id={`${tone}-dialog-title`}>{title}</h2>
        <p>{children}</p>
        <div className="confirm-actions">
          {/* Safe choice first: showModal() focuses the first focusable control. */}
          <button type="button" className="button button-secondary" onClick={onCancel}>Keep editing</button>
          <button type="button" className={`button ${tone === "danger" ? "button-danger" : "button-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
