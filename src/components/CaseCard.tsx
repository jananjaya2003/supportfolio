import { motion } from "framer-motion";
import { ArrowRight, Image as ImageIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { caseIconFor } from "../caseVisuals";
import type { TroubleshootingCase } from "../data/cases";

/** Library card. `preview` renders it inert (no link, no layout animation) for the editor. */
export function CaseCard({ item, index = 0, preview = false }: { item: TroubleshootingCase; index?: number; preview?: boolean }) {
  const Icon = caseIconFor(item);
  const imageCount = item.images.length;
  return (
    <motion.article
      className={`case-card${preview ? " is-preview" : ""}`}
      layout={!preview}
      initial={preview ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.018, 0.18) }}
    >
      <div className="card-top">
        <span className="case-icon"><Icon size={17} />{item.emoji && <span className="case-emoji" aria-hidden="true">{item.emoji}</span>}</span>
        <span className="case-number">CASE {item.id}</span>
      </div>
      <div className="case-category">{item.category}</div>
      <h3>{item.title}</h3>
      <p className="case-description">{item.description}</p>
      <div className="case-meta">
        <span className={`difficulty ${item.difficulty === "Easy" ? "easy" : item.difficulty === "Advanced" ? "advanced" : ""}`}>{item.difficulty}</span>
        <span>{item.device}</span>
        {imageCount > 0 && <span className="case-image-count"><ImageIcon size={10} aria-hidden="true" />{imageCount}<span className="visually-hidden"> {imageCount === 1 ? "image" : "images"}</span></span>}
      </div>
      <div className="card-action">View solution <ArrowRight size={13} /></div>
      {!preview && <Link className="case-open" to={`/cases/${item.id}`} aria-label={`View solution for ${item.title}`} />}
    </motion.article>
  );
}
