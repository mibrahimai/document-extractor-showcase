"use client";

import Link from "next/link";
import { useShell } from "@/components/ShellContext";
import { Icon } from "@/components/Icon";
import { StatusBar } from "@/components/StatusBar";
import { PRESETS } from "@/lib/presets";
import { timeAgo } from "@/lib/format";
import styles from "./home.module.css";

const PIPELINE = [
  { icon: "upload", title: "Ingest", body: "PDFs, scans, Word, Excel, images. Per-page OCR fallback for scanned or broken-font pages." },
  { icon: "scan", title: "Triage", body: "Your plain-English rules decide what's in scope, so irrelevant attachments never reach extraction." },
  { icon: "sparkles", title: "Extract", body: "A local LLM fills your fields, with a confidence score and a reason for every blank." },
  { icon: "eye", title: "Review", body: "Only uncertain fields need a human. Side-by-side original, keyboard-driven approve & next." },
  { icon: "table", title: "Export", body: "One standardized Excel/CSV per project: approved rows, your columns, your labels." },
  { icon: "truck", title: "Fulfil", body: "Turn an approved request into a task: invite vendors, draft emails, track delivery and invoice." },
];

const FEATURES = [
  { icon: "shield", title: "Private by default", body: "Runs on your own machine with Ollama. Documents never leave your network." },
  { icon: "layers", title: "One app, many verticals", body: "Each project has its own rules, fields and sources. Add a new document type without writing code." },
  { icon: "braces", title: "Portable templates", body: "Export a project's template as JSON and import it anywhere, or start from a ready-made one." },
  { icon: "zap", title: "Built for messy inputs", body: "Image-only pages, broken PDF fonts, Word checkbox forms: the edge cases are handled, not ignored." },
];

export default function HomePage() {
  const { projects, health } = useShell();
  const totals = projects.reduce(
    (acc, p) => {
      acc.docs += p.doc_count;
      acc.review += p.status_counts?.needs_review ?? 0;
      acc.approved += p.status_counts?.approved ?? 0;
      acc.extracted += p.status_counts?.extracted ?? 0;
      return acc;
    },
    { docs: 0, review: 0, approved: 0, extracted: 0 }
  );
  const llm = health && health !== "offline" ? health.llm : undefined;
  const busiest = [...projects].sort(
    (a, b) => (b.status_counts?.needs_review ?? 0) - (a.status_counts?.needs_review ?? 0)
  )[0];

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>
            <Icon name="shield" size={14} /> Local AI · your documents stay on your machine
          </span>
          <h1>
            Messy documents in.
            <br />
            <span className={styles.gradient}>Clean, reviewed data out.</span>
          </h1>
          <p className={styles.lede}>
            Point it at a folder of PDFs, scans, Word and Excel files. It works out which ones
            matter, pulls out the fields you define, sends anything uncertain to a human, and
            exports one standardized spreadsheet, for any kind of document.
          </p>
          <div className={styles.heroCtas}>
            <Link href="/projects/new" className="btn btn-primary">
              <Icon name="sparkles" size={15} /> Start from a template
            </Link>
            <Link href="/projects" className="btn">
              Open projects <Icon name="arrowRight" size={15} />
            </Link>
          </div>
        </div>

        <div className={styles.demo} aria-hidden="true">
          <div className={styles.demoDoc}>
            <div className={styles.demoDocHead}>
              <Icon name="file" size={14} /> attachment_7.pdf
              <span className={styles.demoPill}>page 1 of 12</span>
            </div>
            <div className={styles.demoLines}>
              <span style={{ width: "62%" }} />
              <span style={{ width: "88%" }} />
              <p>
                Solicitation <mark>FA521526Q0054</mark> — CCTV replacement at Bellows AFS, HI.
              </p>
              <span style={{ width: "74%" }} />
              <p>
                Offers due <mark>14 Oct 2026, 2:00 PM HST</mark>. NAICS <mark>561621</mark>.
              </p>
              <span style={{ width: "91%" }} />
              <span style={{ width: "55%" }} />
              <p>
                Questions to the contracting officer by email.
              </p>
              <span style={{ width: "80%" }} />
            </div>
          </div>
          <div className={styles.demoArrow}>
            <Icon name="sparkles" size={16} />
          </div>
          <div className={styles.demoFields}>
            {[
              { k: "Solicitation #", v: "FA521526Q0054", c: 0.99 },
              { k: "Response deadline", v: "2026-10-14", c: 0.96 },
              { k: "NAICS code", v: "561621", c: 0.93 },
              { k: "Contact email", v: "needs review", c: 0.41, low: true },
            ].map((f, i) => (
              <div key={f.k} className={styles.demoField} style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
                <div className={styles.demoFieldTop}>
                  <span>{f.k}</span>
                  <span className={f.low ? styles.demoLow : styles.demoConf}>{Math.round(f.c * 100)}%</span>
                </div>
                <div className={f.low ? styles.demoValueLow : styles.demoValue}>{f.v}</div>
                <div className={styles.demoMeter}>
                  <span style={{ width: `${f.c * 100}%` }} className={f.low ? styles.demoMeterLow : undefined} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.stats}>
        <Stat label="Documents processed" value={totals.docs} icon="file" />
        <Stat label="Waiting for review" value={totals.review} icon="eye" tone="warn" href={busiest ? `/projects/${busiest.id}` : undefined} />
        <Stat label="Extracted" value={totals.extracted} icon="sparkles" tone="info" />
        <Stat label="Approved" value={totals.approved} icon="check" tone="ok" />
        <div className={styles.stat}>
          <div className={styles.statLabel}>
            <Icon name="cpu" size={14} /> Model
          </div>
          <div className={styles.statModel}>
            {llm ? llm.model : health === "offline" ? "API offline" : "…"}
          </div>
          <div className={styles.statSub}>
            {!llm
              ? ""
              : !llm.reachable
                ? `${llm.provider} not reachable`
                : llm.model_available
                  ? llm.provider === "ollama"
                    ? "Ready · runs locally"
                    : `Ready · ${llm.provider} API`
                  : llm.provider === "ollama"
                    ? "Run: ollama pull " + llm.model
                    : "Check API key / model in .env"}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>How it works</h2>
          <p>Six stages, one screen each. Every stage is visible and correctable.</p>
        </div>
        <ol className={styles.pipeline}>
          {PIPELINE.map((s, i) => (
            <li key={s.title} className={styles.step}>
              <div className={styles.stepIcon}>
                <Icon name={s.icon} size={18} />
              </div>
              <div className={styles.stepNum}>0{i + 1}</div>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Start from a template</h2>
          <p>Ready-made fields and relevance rules for common document types. Edit anything before you create.</p>
        </div>
        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <Link key={p.id} href={`/projects/new?preset=${p.id}`} className={styles.preset}>
              <span className={styles.presetIcon}>
                <Icon name={p.icon} size={18} />
              </span>
              <span className={styles.presetText}>
                <span className={styles.presetName}>{p.name}</span>
                <span className={styles.presetAudience}>{p.audience}</span>
                <span className={styles.presetBlurb}>{p.blurb}</span>
              </span>
              <Icon name="arrowRight" size={15} className={styles.presetArrow} />
            </Link>
          ))}
          <Link href="/projects/new" className={`${styles.preset} ${styles.presetBlank}`}>
            <span className={styles.presetIcon}>
              <Icon name="plus" size={18} />
            </span>
            <span className={styles.presetText}>
              <span className={styles.presetName}>Blank project</span>
              <span className={styles.presetBlurb}>Define your own fields, or import a template JSON file.</span>
            </span>
          </Link>
        </div>
      </section>

      {projects.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>Your projects</h2>
            <Link href="/projects" className={styles.link}>
              View all <Icon name="arrowRight" size={14} />
            </Link>
          </div>
          <div className={styles.projectList}>
            {projects.slice(0, 6).map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className={styles.projectRow}>
                <span className={styles.projectAvatar}>{p.name.slice(0, 1).toUpperCase()}</span>
                <span className={styles.projectMain}>
                  <span className={styles.projectName}>{p.name}</span>
                  <span className={styles.projectMeta}>
                    {p.doc_count} documents · last run {timeAgo(p.last_run_at)}
                  </span>
                </span>
                <span className={styles.projectBar}>
                  <StatusBar counts={p.status_counts} height={6} />
                </span>
                {(p.status_counts?.needs_review ?? 0) > 0 && (
                  <span className="badge badge-needs_review">{p.status_counts?.needs_review} to review</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <div className={styles.features}>
          {FEATURES.map((f) => (
            <div key={f.title} className={styles.feature}>
              <Icon name={f.icon} size={18} className={styles.featureIcon} />
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  icon,
  tone,
  href,
}: {
  label: string;
  value: number;
  icon: string;
  tone?: "warn" | "ok" | "info";
  href?: string;
}) {
  const body = (
    <>
      <div className={styles.statLabel}>
        <Icon name={icon} size={14} /> {label}
      </div>
      <div className={`${styles.statValue} ${tone ? styles[`tone_${tone}`] : ""}`}>
        {value.toLocaleString()}
      </div>
      {href && <div className={styles.statSub}>Open the busiest queue →</div>}
    </>
  );
  return href ? (
    <Link href={href} className={`${styles.stat} ${styles.statLink}`}>
      {body}
    </Link>
  ) : (
    <div className={styles.stat}>{body}</div>
  );
}
