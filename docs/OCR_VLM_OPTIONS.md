# OCR / Vision-LLM options for hard scans

Reference notes on what's available beyond the current Tesseract setup (`src/ingest.py`), for scanned images, handwriting, and the general population of RFQ-style attachments. Two independent tracks — local/free and cloud/paid — each usable on its own.

Accuracy numbers below are ballparks from published benchmarks and vendor claims, not guarantees — real accuracy depends heavily on scan quality, layout, and handwriting style. No option here gets close to 100% on genuinely bad scans (heavy skew, very low resolution, messy cursive handwriting) — that gap is currently unsolved industry-wide.

---

## 1. Local / open-source (self-hosted, no per-page cost, data stays on-machine)

Fits the existing local Ollama setup (`qwen2.5` per `WORKFLOW.md`) — no data leaves the machine, no per-document fee.

| Option | What it is | Accuracy ballpark | Best fit |
|---|---|---|---|
| **Tesseract** (current) | Classic OCR engine, already wired in via `pytesseract` (`src/ingest.py`) | ~95-99% on clean, high-res, straight printed scans. Drops to ~70-90% on skewed/low-quality scans. Not built for handwriting — fails or produces garbage. | Fine as-is for clean digital-quality scans; not a solution for hard cases. |
| **GOT-OCR2.0** | Open-source OCR-focused vision model, built specifically to outperform Tesseract on messy scans | Meaningfully better than Tesseract on skew, low-res, and dense layouts in published comparisons; still weak on handwriting | Drop-in OCR upgrade — same "text soup" pipeline shape, just a stronger extractor. |
| **Qwen2.5-VL** (or Qwen2-VL) | Open-source general vision-LLM with strong document/layout understanding | ~90%+ field-level on typed/printed docs in benchmark tasks; handles tables and multi-column layout much better than classic OCR; noticeably better than Tesseract on clear handwriting (rough 80-90% range), still degrades hard on messy cursive | Can replace the INGEST→LLM EXTRACT split entirely — feed it the page image, get structured fields directly, one local model instead of two pipeline stages. |
| **MiniCPM-V / InternVL** | Smaller open-source vision-LLMs | Slightly behind Qwen2.5-VL on raw accuracy but lighter to run (less VRAM/CPU) | Budget/low-resource local option when full Qwen2.5-VL isn't practical on the hardware. |

**Honest caveat:** none of these solve handwriting reliably. They reduce failure on skew/low-res/tables; messy cursive handwriting is still a coin flip with any local model.

---

## 2. Cloud / paid (higher accuracy, per-page or subscription cost, data leaves the machine)

| Option | What it is | Accuracy ballpark | Cost posture | Best fit |
|---|---|---|---|---|
| **AWS Textract** | Cloud OCR + forms/tables/handwriting (ICR) detection | ~95-99% on printed text; handwriting (ICR) mode ~85-95% word-accuracy on *legible* handwriting, drops fast on messy cursive | Per-page pricing (higher for Tables/Forms features) | Good when you need structured table/form extraction plus decent handwriting support in one managed API. |
| **Azure Document Intelligence** | Cloud OCR + prebuilt layout/invoice/form models | Comparable to Textract; strong prebuilt models for common document types (invoices, receipts) | Per-page pricing, subscription tiers | Best fit if the client is already on Azure, or documents match a prebuilt model type. |
| **Google Document AI** | Cloud OCR + specialized parsers | Comparable to the above two | Per-page pricing | Comparable alternative when already on GCP. |
| **Mistral OCR API** | Dedicated OCR/document-parsing API, positioned specifically to beat classic OCR on scanned/complex PDFs | Vendor-claimed ~95%+ on their own benchmarks; independent numbers land a bit lower but still ahead of Tesseract on messy/complex layouts | Per-page/API pricing | Worth piloting as a mid-cost step up from local OCR before jumping to full frontier VLMs. |
| **LlamaParse / Reducto** | Dedicated document-parsing services built on top of VLMs, tuned for tables and complex layout | Published comparisons show 85-95%+ "usable" table extraction vs. 60-80% for classic OCR pipelines on complex tables | Per-page/subscription pricing | Best when the pain point is specifically messy tables/multi-column RFQ line items, not just raw text. |
| **Frontier vision-LLMs directly** (GPT-4o/5, Claude, Gemini vision) | Send the page image straight to the model, get structured extraction back in one call | ~90-98% field-level accuracy on typed/printed docs; ~80-90% on clear handwriting, 40-60% on messy/low-res handwriting | Per-token/API pricing (can add up on high page volumes) | Collapses `WORKFLOW.md`'s INGEST + LLM EXTRACT steps into a single call; highest ceiling on messy real-world documents, but recurring cost per page and data leaves the machine. |

---

## Summary

- **Cheapest ceiling raise:** swap Tesseract for GOT-OCR2.0 locally — same architecture, stronger extractor, still free and private.
- **Biggest architectural win locally:** Qwen2.5-VL running locally, replacing OCR+LLM-extract with one vision-LLM call.
- **Cheapest cloud step-up:** Mistral OCR API as a fallback path for documents Tesseract/local VLM flags as low-confidence.
- **Highest accuracy overall, at recurring cost:** frontier vision-LLMs (GPT-4o/5, Claude, Gemini) doing extraction directly from page images — no OCR step at all.
- **No option reliably solves messy handwriting** — treat handwritten RFQ attachments as `needs_review` regardless of which approach is used.
