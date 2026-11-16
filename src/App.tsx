import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleCheck,
  CircleHelp,
  Clock3,
  Cloud,
  Command,
  Database,
  FileQuestion,
  ImagePlus,
  Laptop,
  Mail,
  Monitor,
  Moon,
  Network,
  Pencil,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Sun,
  Usb,
  Wifi,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, MotionConfig, animate, motion, useInView, useReducedMotion } from "framer-motion";
import { BrowserRouter, Link, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { CaseCard } from "./components/CaseCard";
import { CaseGallery } from "./components/CaseGallery";
import { caseIconFor, categoryIconFor } from "./caseVisuals";
import { orderedCategories } from "./data/cases";
import { CaseStoreProvider, useCases } from "./data/caseStore";

// Loaded only when the server says this visitor can edit (protected address or npm run dev).
const CaseEditor = lazy(() => import("./editor/CaseEditor"));

const ALL_CASES = "All cases";

function Brand({ footer = false }: { footer?: boolean }) {
  return (
    <Link className={`brand${footer ? " footer-brand" : ""}`} to="/" aria-label="Supportfolio home">
      <span className="brand-mark" aria-hidden="true">
        <span className="brand-letter">S</span>
        <span className="brand-dot" />
      </span>
      <span className="brand-word">support<span className="brand-light">folio</span></span>
    </Link>
  );
}

function Header({ theme, onToggleTheme, editing, storage }: { theme: "light" | "dark"; onToggleTheme: () => void; editing: boolean; storage: "cloud" | "local" }) {
  return (
    <header className="topbar">
      <Brand />
      <nav className="top-nav" aria-label="Main navigation">
        <NavLink end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/">Overview</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/cases">Case library</NavLink>
        <NavLink className={({ isActive }) => `nav-link${isActive ? " active" : ""}`} to="/about">About</NavLink>
      </nav>
      <div className="top-actions">
        {editing ? <span className="availability editing" title={storage === "local" ? "Changes are saved on this computer (npm run dev)" : "Changes are saved to Vercel Blob and appear on the public site within a minute"}><span /> Editing {storage === "local" ? "locally" : "live"}</span> : <span className="availability"><span /> IT Support Portfolio</span>}
        <button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title="Toggle color theme">
          {theme === "dark" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}

function DashboardPreview() {
  const { cases } = useCases();
  return (
    <div className="hero-visual" aria-label="Support dashboard illustration">
      <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
      <div className="dashboard-stage">
      <div className="dashboard-card">
        <div className="dash-top"><span className="dash-label"><span className="live-dot" /> SUPPORT OVERVIEW</span><span className="dash-dots">•••</span></div>
        <div className="dash-title">Issue resolution</div>
        <div className="dash-subtitle">Troubleshooting library at a glance</div>
        <div className="chart-wrap">
          <div className="chart-y"><span>100</span><span>75</span><span>50</span><span>25</span></div>
          <div className="chart-area"><div className="chart-grid"><i /><i /><i /><i /></div><svg viewBox="0 0 360 140" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" className="chart-stop" stopOpacity=".26" /><stop offset="1" className="chart-stop" stopOpacity="0" /></linearGradient></defs><path className="chart-fill" d="M0 112 C26 108 36 84 63 91 S99 102 122 73 S158 83 179 59 S214 71 236 44 S268 62 289 32 S329 48 360 16 V140 H0Z" /><path className="chart-line" d="M0 112 C26 108 36 84 63 91 S99 102 122 73 S158 83 179 59 S214 71 236 44 S268 62 289 32 S329 48 360 16" /></svg><span className="chart-tooltip">Cases documented <strong>{cases.length}</strong></span></div>
        </div>
        <div className="chart-legend"><span><i /> Troubleshooting cases</span><span>Updated today</span></div>
        <div className="dash-divider" />
        <div className="dash-bottom"><div className="dash-metric-icon"><Check size={14} /></div><div><strong>Clear, repeatable resolutions</strong><span>Documented from symptom to verification</span></div><span className="metric-arrow">↗</span></div>
      </div>
      <div className="floating-note note-top"><span className="note-icon"><Search size={15} /></span><span><strong>Diagnose with confidence</strong><small>Follow a clear troubleshooting path</small></span></div>
      <div className="floating-note note-bottom"><span className="note-icon note-green"><BadgeCheck size={15} /></span><span><strong>Resolution verified</strong><small>Close the loop with the user</small></span></div>
      </div>
      <div className="visual-spark spark-one">✳</div><div className="visual-spark spark-two">✳</div>
    </div>
  );
}

function Hero() {
  const { cases } = useCases();
  return (
    <section className="hero page-width" id="home">
      <motion.div className="hero-copy" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}>
        <div className="eyebrow"><span className="eyebrow-sparkle" aria-hidden="true">✦</span><span className="eyebrow-line" /> IT OPERATIONS · SERVICE DESK</div>
        <h1>IT Support<br /><span className="heading-accent">Troubleshooting</span><br />Portfolio</h1>
        <p className="hero-subtitle">Real-world IT problems and step-by-step troubleshooting solutions.</p>
        <div className="hero-actions"><Link className="button button-primary" to="/cases">Explore troubleshooting cases <ArrowUpRight size={15} /></Link><Link className="text-link" to="/about">A little about me <ArrowRight size={14} /></Link></div>
        <div className="hero-proof"><div className="avatar-stack" aria-hidden="true"><span>🛠️</span><span>💻</span><span>✨</span></div><span><strong>{cases.length} practical cases</strong><br />Across everyday enterprise IT</span></div>
      </motion.div>
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.65, delay: 0.1 }}><DashboardPreview /></motion.div>
      <Link className="scroll-cue" to="/cases"><ArrowDown size={13} /> EXPLORE THE LIBRARY</Link>
    </section>
  );
}

function FeaturedCases() {
  const { cases } = useCases();
  return (
    <section className="featured-section page-width">
      <div className="section-heading">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> START WITH A COMMON ISSUE</div>
          <h2>Popular <span className="heading-accent">cases</span></h2>
          <p>Explore a few of the problems IT teams solve every day.</p>
        </div>
        <Link className="button button-secondary" to="/cases">Browse all {cases.length} cases <ArrowRight size={14} /></Link>
      </div>
      <div className="case-grid featured-grid">
        {cases.slice(0, 4).map((item, index) => <CaseCard key={item.id} item={item} index={index} />)}
      </div>
    </section>
  );
}

const easeOutExpo = [0.16, 1, 0.3, 1] as const;

/** Counts up from 0 the first time it scrolls into view; screen readers get the final value only. */
function CountUp({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduceMotion) { setDisplay(value); return; }
    const controls = animate(0, value, { duration: 1.1, ease: easeOutExpo, onUpdate: (latest) => setDisplay(Math.round(latest)) });
    return () => controls.stop();
  }, [inView, reduceMotion, value]);
  return <><span className="visually-hidden">{value}</span><span ref={ref} aria-hidden="true">{display}</span></>;
}

function StatsStrip() {
  const { cases } = useCases();
  const stats: { icon: LucideIcon; value: number | string; caption: string }[] = [
    { icon: Database, value: cases.length, caption: "Documented cases" },
    { icon: Command, value: new Set(cases.map((item) => item.category)).size, caption: "Support categories" },
    { icon: Activity, value: "5-step", caption: "Diagnostic approach" },
    { icon: ShieldCheck, value: "People-first", caption: "Support, every step of the way" },
  ];
  return (
    <section className="stats-strip" aria-label="Portfolio highlights">
      <div className="stats-inner">
        {stats.map(({ icon: Icon, value, caption }, index) => (
          <motion.div className="stat" key={caption} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.6 }} transition={{ duration: 0.5, delay: index * 0.08, ease: easeOutExpo }}>
            <span className="stat-icon" aria-hidden="true"><Icon size={20} strokeWidth={1.9} /></span>
            <div className="stat-text">
              <strong>{typeof value === "number" ? <CountUp value={value} /> : value}</strong>
              <span>{caption}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function HomePage() {
  return <><Hero /><StatsStrip /><FeaturedCases /><section className="closing-cta page-width"><div className="cta-symbol"><ArrowUpRight size={18} /></div><div><h2>Every issue has a path forward.</h2><p>Explore practical, step-by-step support cases.</p></div><Link className="button button-light" to="/cases">Explore all cases <ArrowRight size={13} /></Link></section></>;
}

function CaseLibrary() {
  const { cases, session } = useCases();
  const [category, setCategory] = useState(ALL_CASES);
  const [query, setQuery] = useState("");
  const categories = useMemo(() => [ALL_CASES, ...orderedCategories(cases)], [cases]);
  const results = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return cases.filter((item) => {
      const searchable = [item.title, item.category, item.device, item.description, item.problem, ...item.symptoms, ...item.causes, ...item.images.map((image) => image.caption)].join(" ").toLowerCase();
      return (!normalized || searchable.includes(normalized)) && (category === ALL_CASES || item.category === category);
    });
  }, [cases, category, query]);
  const filtered = Boolean(query) || category !== ALL_CASES;
  const clearFilters = () => { setCategory(ALL_CASES); setQuery(""); };

  return (
    <section className="library-section page-width cases-page">
      <div className="page-intro">
        <div><div className="eyebrow"><span className="eyebrow-line" /> THE KNOWLEDGE BASE</div><h1>IT support, <span className="heading-accent">step by step.</span></h1><p>Browse practical troubleshooting guides by issue, system, or category.</p></div>
        <div className="page-intro-aside">
          {session.canEdit && <Link className="button button-primary new-case-button" to="/cases/new"><Plus size={15} /> New case</Link>}
          <div className="library-count"><span className="count-icon"><FileQuestion size={16} /></span><span><strong>{results.length}</strong> cases<br /><small>Ready to explore</small></span></div>
        </div>
      </div>
      <div className="library-controls">
        <label className="search-box"><Search aria-hidden="true" /><input type="search" aria-label="Search troubleshooting cases" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search issues, devices, or symptoms..." autoComplete="off" /><kbd><Command size={10} /> K</kbd></label>
        <div className="filters-wrap"><span className="filter-label">FILTER BY</span><div className="filter-list" aria-label="Filter by category">{categories.map((filter) => { const Icon = filter === ALL_CASES ? null : categoryIconFor(filter); const count = filter === ALL_CASES ? cases.length : cases.filter((item) => item.category === filter).length; return <button key={filter} type="button" className={`filter-chip${category === filter ? " active" : ""}`} onClick={() => setCategory(filter)} aria-pressed={category === filter}>{Icon && <Icon size={12} />}{filter}<span>{count}</span></button>; })}</div></div>
      </div>
      <div className="results-line"><span>Showing {results.length === cases.length && !filtered ? "all " : ""}{results.length} {results.length === 1 ? "case" : "cases"}{filtered && ` of ${cases.length}`}</span>{filtered && <button className="clear-filters" type="button" onClick={clearFilters}>Clear filters <X size={12} /></button>}</div>
      <motion.div className="case-grid" layout aria-live="polite"><AnimatePresence mode="popLayout">{results.map((item, index) => <CaseCard key={item.id} item={item} index={index} />)}</AnimatePresence></motion.div>
      {results.length === 0 && <div className="empty-state"><Search size={28} /><h3>No cases found</h3><p>Try another search term or clear your category filter.</p><button className="button button-secondary" type="button" onClick={clearFilters}>Clear filters</button></div>}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return <ul className="bullet-list">{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>;
}

function CaseDetailsPage() {
  const { caseId } = useParams();
  const { cases, session } = useCases();
  const item = cases.find((entry) => entry.id === caseId);
  if (!item) return <NotFoundPage />;
  const Icon = caseIconFor(item);
  const listSection = ([title, items]: readonly [string, string[]]) => items.length > 0 && <section className="detail-section" key={title}><h2>{title}</h2><BulletList items={items} /></section>;

  return (
    <motion.div className="case-detail-page" aria-labelledby="case-title" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      <div className="detail-page-content">
        <div className="detail-toolbar">
          <Link className="detail-back" to="/cases"><ArrowLeft size={13} /> Back to case library</Link>
          {session.canEdit && <Link className="button button-secondary detail-edit" to={`/cases/${item.id}/edit`}><Pencil size={13} /> Edit case</Link>}
        </div>
        <div className="detail-heading-row"><span className="detail-icon"><Icon size={23} />{item.emoji && <span className="detail-emoji" aria-hidden="true">{item.emoji}</span>}</span><div><div className="case-category">CASE {item.id} · {item.category}</div><h1 id="case-title">{item.title}</h1><p className="detail-subtitle">{item.description}</p><div className="detail-tags"><span className="detail-tag category">{item.category}</span><span className="detail-tag">{item.difficulty} difficulty</span><span className="detail-tag">{item.device}</span></div></div></div>
        <div className="detail-summary"><div className="summary-cell"><span>ESTIMATED TIME</span><strong><Clock3 size={12} /> {item.time}</strong></div><div className="summary-cell"><span>DIFFICULTY</span><strong>{item.difficulty}</strong></div><div className="summary-cell"><span>CASE NUMBER</span><strong>#{item.id}</strong></div></div>
        <section className="detail-section"><h2>Problem overview</h2><p>{item.problem}</p></section>
        {item.images.length > 0
          ? <section className="detail-section" aria-labelledby="case-images-title"><h2 id="case-images-title">Screenshots &amp; evidence <span className="section-count">{item.images.length}</span></h2><CaseGallery images={item.images} title={item.title} /></section>
          : session.canEdit && <Link className="gallery-empty" to={`/cases/${item.id}/edit#images`}><span className="gallery-empty-icon"><ImagePlus size={18} /></span><span><strong>Add screenshots to this case</strong>Error messages, settings screens, or before-and-after photos make a fix easier to follow.</span></Link>}
        {listSection(["Symptoms", item.symptoms])}
        {listSection(["Possible causes", item.causes])}
        <section className="detail-section"><h2>Step-by-step troubleshooting flow</h2><ol className="steps-list">{item.steps.map(([title, description], index) => <li key={`${index}-${title}`}><div><strong>{title}</strong><p>{description}</p></div></li>)}</ol></section>
        <section className="detail-section resolution-box"><h2>Root cause</h2><p>{item.root}</p></section>
        <section className="detail-section"><h2>Final resolution</h2><p>{item.resolution}</p></section>
        {listSection(["Verification steps", item.verification])}
        {listSection(["Prevention tips", item.prevention])}
        {listSection(["Tools used", item.tools])}
        {listSection(["Skills demonstrated", item.skills])}
        <section className="detail-section"><h2>Troubleshooting flowchart</h2><div className="flowchart" role="img" aria-label="Troubleshooting flow: report symptoms, identify scope, test likely cause, apply approved fix, verify with user">{[["01 · REPORT","Symptoms & scope"],["02 · DIAGNOSE","Collect evidence"],["03 · ISOLATE","Test one cause"],["04 · RESOLVE","Apply approved fix"],["05 · VERIFY","Confirm with user"]].map(([title, caption], index) => <div className="flow-step" key={title}><div className={`flow-node${index === 0 ? " start" : index === 4 ? " end" : ""}`}><strong>{title}</strong>{caption}</div>{index < 4 && <ChevronRight className="flow-arrow" size={15} aria-hidden="true" />}</div>)}</div></section>
        {item.tree.length > 0 && <section className="detail-section"><h2>Decision tree</h2><div className="decision-list">{item.tree.map(([question, answer], index) => <details key={`${index}-${question}`}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>}
        <div className="detail-footer"><strong>Support note:</strong> Verify identity before account actions, use only authorized tools and managed procedures, protect user data, and escalate when evidence indicates a security, safety, or hardware risk.</div>
      </div>
    </motion.div>
  );
}

function About() {
  const skills = ["Windows", "Microsoft 365", "Active Directory", "Networking", "Printers", "Hardware Support", "Outlook", "Teams", "Intune", "Azure AD", "Helpdesk Support"];
  return (
    <section className="about-section about-page"><div className="about-page-heading page-width"><div className="eyebrow"><span className="eyebrow-line" /> ABOUT MY APPROACH</div><h1>People-first <span className="heading-accent">IT support.</span></h1><p>Patient troubleshooting, practical solutions, and a clear path from problem to resolution.</p></div><div className="about-inner page-width">
      <div className="about-visual"><div className="about-icon-grid"><span><Monitor size={15} /></span><span><Cloud size={15} /></span><span><Network size={15} /></span><span><Wifi size={15} /></span><span><Laptop size={15} /></span><span><Printer size={15} /></span><span><Mail size={15} /></span><span><Usb size={15} /></span><span><Wrench size={15} /></span></div><div className="about-orb" /><div className="about-caption"><span className="about-caption-icon"><CircleHelp size={15} /></span><span><strong>Curious by nature.</strong><br />Methodical by practice.</span></div></div>
      <div className="about-copy"><div className="eyebrow"><span className="eyebrow-line" /> THE PERSON BEHIND THE TICKETS</div><h2>Good support starts<br />with <span className="heading-accent">good listening.</span></h2><p className="about-description">I’m an IT Support Engineer who enjoys untangling technical problems and making technology work for people. This portfolio shares a practical, methodical approach to diagnosing common workplace IT issues—from the first user report through a verified resolution.</p><p className="about-description">Every case is a reminder: ask good questions, change one thing at a time, explain what’s happening, and confirm the fix with the person who needs it.</p><div className="skills-heading">AREAS OF EXPERIENCE <span>11 skills</span></div><div className="skill-list">{skills.map((skill) => <span key={skill}>{skill}</span>)}</div><Link className="button button-primary about-cta" to="/cases">Browse the case library <ArrowUpRight size={14} /></Link></div>
    </div></section>
  );
}

function NotFoundPage() {
  return <section className="not-found-page page-width"><div className="eyebrow"><span className="eyebrow-line" /> PAGE NOT FOUND</div><h1>Looks like this page<br /><span className="heading-accent">isn't in the queue.</span></h1><p>That page may have moved. Head back to the home page or browse the troubleshooting cases.</p><div className="hero-actions"><Link className="button button-primary" to="/">Back to home <ArrowUpRight size={15} /></Link><Link className="text-link" to="/cases">Browse the case library <ArrowRight size={14} /></Link></div></section>;
}

/** Shown while the latest cases load; appears only if loading takes longer than a blink. */
function PageLoader() {
  return <div className="page-loader" role="status" aria-live="polite"><span className="brand-mark loader-mark" aria-hidden="true"><span className="brand-letter">S</span><span className="brand-dot" /></span><span>Loading the case library…</span></div>;
}

/** One-shot confirmation passed through navigation state, e.g. navigate(path, { state: { flash: "Case saved" } }). */
function FlashToast() {
  const location = useLocation();
  const navigate = useNavigate();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!flash) return;
    setMessage(flash);
    // Clear it from history so a refresh or Back doesn't replay the toast.
    navigate(`${location.pathname}${location.search}${location.hash}`, { replace: true, state: null });
  }, [flash, location.pathname, location.search, location.hash, navigate]);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  return (
    <div className="toast-region" role="status" aria-live="polite">
      <AnimatePresence>
        {message && (
          <motion.div className="toast" initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.22 }}>
            <CircleCheck size={17} aria-hidden="true" /><span>{message}</span>
            <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss notification"><X size={14} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppLayout() {
  const { cases, status, session } = useCases();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return localStorage.getItem("supportfolio-theme") === "dark" ? "dark" : "light"; }
    catch (error) { console.warn("Theme preference could not be loaded.", error); return "light"; }
  });
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("supportfolio-theme", theme); }
    catch (error) { console.warn("Theme preference could not be saved.", error); }
  }, [theme]);
  useEffect(() => {
    // Pages that open at an anchor (e.g. /cases/04/edit#images) scroll themselves once rendered.
    if (!window.location.hash) window.scrollTo(0, 0);
  }, [location.pathname]);
  useEffect(() => {
    const path = location.pathname;
    const [, caseId, editing] = /^\/cases\/(\d+)(\/edit)?$/.exec(path) ?? [];
    const currentCase = cases.find((item) => item.id === caseId);
    document.title = path === "/cases/new"
      ? "New case | Supportfolio"
      : currentCase
        ? `${editing ? "Edit: " : ""}${currentCase.title} | Supportfolio`
        : path === "/cases"
          ? "Case Library | Supportfolio"
          : path === "/about"
            ? "About | Supportfolio"
            : path === "/"
              ? "IT Support Troubleshooting Portfolio"
              : "Page Not Found | Supportfolio";
  }, [location.pathname, cases]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && location.pathname === "/cases") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>(".search-box input")?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [location.pathname]);

  const editorPage = session.canEdit && <Suspense fallback={<div className="page-loading page-width" role="status">Loading the case editor…</div>}><CaseEditor /></Suspense>;

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header theme={theme} editing={session.canEdit} storage={session.storage} onToggleTheme={() => setTheme((current) => current === "dark" ? "light" : "dark")} />
      {session.notice && <div className="site-notice" role="status">{session.notice}</div>}
      <main id="main-content">
        {status === "loading" ? <PageLoader /> : <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cases" element={<CaseLibrary />} />
          {editorPage && <Route path="/cases/new" element={editorPage} />}
          {editorPage && <Route path="/cases/:caseId/edit" element={editorPage} />}
          <Route path="/cases/:caseId" element={<CaseDetailsPage />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>}
      </main>
      <footer className="footer"><Brand footer /><span>IT Support Troubleshooting Portfolio <span className="footer-dot">·</span> Built around better support.</span><span className="footer-links">{session.editUrl && <a className="footer-manage" href={`${session.editUrl}/cases`} title="Owner sign-in: opens the editor after a Vercel login">Manage cases</a>}<Link to="/">Back to top ↑</Link></span></footer>
      <FlashToast />
    </>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <CaseStoreProvider>
        <BrowserRouter><AppLayout /></BrowserRouter>
      </CaseStoreProvider>
    </MotionConfig>
  );
}
