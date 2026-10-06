# How this system works (mental map)

Read this while you click through a real run. Do → see → then come back here.

```
SAM.gov RFQs                data/raw/<notice>/
(or drop your own files)  →   attachment_*.pdf/docx/xlsx
                              description.txt
                                    │
                                    ▼
                         ┌──────────────────┐
                         │ 1. INGEST        │  src/ingest.py
                         │ detect type      │
                         │ PDF→pdfplumber   │
                         │ DOCX/XLSX→libs   │
                         │ scan/image→OCR*  │
                         └────────┬─────────┘
                                  │ plain text
                                  ▼
                         ┌──────────────────┐
                         │ 2. LLM EXTRACT   │  src/llm.py
                         │ Ollama qwen2.5   │
                         │ schema-forced    │
                         │ JSON fields      │
                         │ null + reason    │
                         └────────┬─────────┘
                                  │
                                  ▼
                         ┌──────────────────┐
                         │ 3. VALIDATE      │  src/validate.py
                         │ dates/email/NAICS│
                         │ confidence       │
                         │ → needs_review?  │
                         └────────┬─────────┘
                                  │
                                  ▼
                         data/processed/*.json
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              Excel/CSV     Review UI      metrics in JSON
           data/exports/   web + api.py    elapsed_sec, cost
```

## Status flow

`new → extracted | needs_review → approved` (or `rejected`)

Low confidence or bad formats never auto-approve.

## Multi-project (current)

The system is no longer single-tenant. Every vertical — SAM.gov RFQs, defense
aviation parts, used cars, invoices, whatever you point it at — is its own
**project**: its own relevance rules + fields (`src/project.py`, backed by
`data/app.db`), its own `data/projects/<slug>/{raw,text,processed,exports,labels}`,
its own document source (`src/sources/`: manual upload, a watched folder, or
the SAM.gov API). See `python src/list_projects.py` for what exists, or open
`/projects` in the web UI to create one with no code — name it, list the
fields to extract, describe what counts as in/out of scope, pick a source.

First time on this checkout: `python src/migrate_to_projects.py` turns the old
single-tenant `data/` tree into two seeded projects (`sam-rfq-default`,
`defense-aviation`) without touching the original files.

## Commands

```bash
# from document-extractor/
.\.venv\Scripts\activate
python src/migrate_to_projects.py         # one-time, only if data/app.db doesn't exist yet
python src/list_projects.py               # see what projects exist

python src/pipeline.py --project sam-rfq-default --limit 5
python src/pipeline.py --project sam-rfq-default --all --force
python src/eval.py --project sam-rfq-default

# API + UI
.\.venv\Scripts\uvicorn.exe api:app --app-dir src --port 8787
cd web && npm run dev                     # http://localhost:3000 -> /projects
```

## What “done” looks like when you test

1. Open UI → list of docs with status badges  
2. Click one → left = source / text preview, right = fields  
3. Fix a wrong field → Approve  
4. Open `data/exports/rfq_extractions.xlsx` — your correction is there  
5. Open a garbage/empty scan → fields are `null` with reasons, status `needs_review`

\*OCR needs Tesseract installed on Windows for scanned/photographed docs. Digital PDFs work without it.

## Client templates (match demanded fields)

Each project carries its own field list + relevance rules (`src/project.py`,
stored in `data/app.db`, not a flat file anymore). The original two verticals
still exist as seeded projects:

| Project slug | Use |
|---|---|
| `sam-rfq-default` | Default SAM.gov-style fields |
| `defense-aviation` | Practice client columns from the UAE RFQ job (RFQ #, platform, NSN, condition…) |

`data/templates/*.json` is kept only as the source `migrate_to_projects.py`
seeds those two from — new projects don't need a file at all, just
`POST /api/projects` (or the `/projects/new` UI form) with a name, a field
list, and a relevance-scope description.

Then re-run `python src/pipeline.py --project <slug> --file ... --force` so
the LLM extracts that project's columns.

**Overall Conf** averages only **filled** fields (value present). A non-RFQ with all nulls shows `0.00` / `0 filled`, not fake `1.00`.

## Results (Phase 5 — measured, not assumed)

Ran the full 166-document raw corpus through the pipeline (111 not_relevant, 33 extracted, 20 needs_review, 2 approved) and hand-labeled **44 real documents** (target: ≥40) drawn from it — ship outfitting, corrosion-control services, aviation NSN parts, medical equipment, fire suppression, CCTV, road construction, HAZMAT pickup, and more. Ground truth was written by independently reading each source document (or its full extracted text under `data/text/`), not by trusting the model's own output. Run `python src/eval.py` to regenerate `data/exports/metrics.json`.

| Metric | Result |
|---|---|
| Triage accuracy (relevant vs. not_relevant) | 41/42 = **97.6%** |
| Per-field accuracy (all filled + correctly-null fields) | 314/363 = **86.5%** |
| Avg. time per document (full extract) | ~19s (local qwen2.5:14b on an RTX A4000) |
| Avg. cost per document | **$0.00** (Ollama, local) |

### What actually breaks (the point of Phase 5)

- **Confident wrong answers exist.** A 394-char equipment-list attachment got `solicitation_number: "CFWP AIMD Guam Corrosion Contract"` at 0.9 confidence — the model lifted the document *title* and called it a solicitation number. The real number never appears in that attachment.
- **The same document, run twice, disagrees with itself.** The Corrosion-Control solicitation exists 2–3× in the corpus (manual SAM.gov zip vs. `fetch_sam.py` API fetch vs. a loose root copy). Re-run under a different template, the same 43,927-char PDF sometimes returns `agency`/`place_of_performance` and sometimes returns `null` for the exact same facts — a side effect of the fixed ~9,800-char prompt truncation landing at a different cutoff depending on the template's own field-shape overhead. Worth fixing before relying on this at scale (raise the cutoff, or prioritize header pages).
- **Vague relevance scope over-admits.** `sam_generic` had no `relevance_scope` (it fell back to a one-line template description), so it triaged a standalone equipment listing as `relevant` — the same document under `defense_aviation`'s explicit exclusion list correctly called it `not_relevant`. Added an explicit `relevance_scope` to `sam_generic.json`; it did **not** fully fix this specific case (qwen2.5:14b didn't reliably honor the new exclusion rule for this borderline doc) — flagging as an open item rather than claiming a fix that isn't proven.
- **Null+reason works as designed.** The deliberately-unreadable scan fixture and a genuinely blank page both short-circuited to `needs_review` before ever reaching the LLM. A synthetic OCR-noise fixture (garbled "Paatform", "icorresion", missing punctuation) still extracted all 12 fields correctly, including normalizing obvious OCR noise rather than transcribing it literally.
- **Free-text fields are unfairly exact-matched.** `description_summary` is a paraphrase field; re-running the same document produces a different, equally-valid summary and gets scored as "wrong" by exact string match. This is a scoring-methodology limitation, not a pipeline bug — worth a fuzzy/semantic comparison if this eval is relied on long-term.
- **Corpus hygiene:** several opportunities exist 2–3× on disk under different paths (manual zip, API fetch, loose root file) from earlier fetch experiments — worth de-duplicating `data/raw/` before treating file counts as a corpus size.

### Definition-of-done checklist

- [x] Handles ≥4 input formats (`digital_pdf`, `scanned_pdf`/`image` via OCR, `xlsx`, plain text) including scanned/photographed fixtures
- [x] Extracts ≥10 fields into a validated schema (`defense_aviation`: 12, `sam_generic`: 15)
- [x] Returns `null` + reason instead of guessing — proven on a deliberately unreadable scan
- [x] Confidence scoring routes low-confidence to a review queue
- [x] Review UI to correct and approve (built; not yet committed to git)
- [x] Measured accuracy on a ≥40-document hand-labeled test set — **44 labeled, 86.5% field accuracy**
- [x] Cost-per-document and time-per-document measured (`$0.00`, ~19s)
- [ ] Runs from a clean clone with documented setup — not yet verified end-to-end on a fresh machine

