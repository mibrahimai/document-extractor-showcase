# Fix: hybrid scanned/digital PDFs losing their scanned page silently

## The bug

`data/raw/95396246a3fd481d97c59e8f466bb440_SOLICITATION_Corrosion_Control_AIMD_GUAM/attachment_8.pdf`
(solicitation N6264926QH041) is a 26-page SF1449 form. Pages 2–26 are normal
digitally-generated text. **Page 1 — the header page with the solicitation
number's issue date, NAICS code, response deadline, issuing agency, and
contact info — is a single flattened image**, not text: someone printed that
page, filled it in / stamped it, and scanned it back into an otherwise-digital
PDF. Confirmed directly, not guessed:

```
pdfplumber / pypdf on page 1:  chars=0   images=1   rects=0   lines=0   annots=0
pdfplumber on page 2:          chars=150 (extracts fine)
```

Before this fix, the pipeline extracted **5 of 15 fields**, then **9 of 15**
after an earlier, unrelated fix (raising the LLM's context window — see
`docs/WORKFLOW.md`'s Results section). `posted_date`, `response_deadline`,
`naics_code`, `contact_name`, and `contact_email` were always `null`
("not provided in document") because that data was never in the text the
model saw — and `agency` came back as a *different, wrong* organization,
because the model reasonably grabbed the nearest analog it could actually see
on a later page (an inspection/acceptance location) instead of the real
issuing office, which only existed on the invisible page 1.

## Root cause

`src/ingest.py`'s scan detection (`detect_kind`) decides OCR at the
**whole-document** level: it sums all extracted text and checks if the total
is under 80 characters. A 26-page document with one blank page and 25 good
ones has thousands of characters overall, so it's classified `digital_pdf`
and OCR is never attempted for *any* page — including the one page that
actually needed it. The heuristic that works fine for a fully-scanned
document (little text everywhere) has a blind spot for a **hybrid** document
(mostly text, with one image-only page mixed in).

## The fix

`src/ingest.py`: `extract_pdf()` now checks **each page individually** while
extracting, not just the document as a whole. For a page with fewer than
`MIN_PAGE_CHARS` (20) native characters *and* at least one embedded image —
the specific, narrow signature of "this page is a picture" — it renders just
that page (`pypdfium2`) and OCRs it (`pytesseract`) via a new
`_ocr_pdf_page()` helper, splicing the recovered text into that page's slot
in the combined document text. Every other page is untouched, so this adds
zero cost to ordinary digital PDFs and only pays the OCR cost for the
specific page(s) that need it.

`render_pdf_page_ocr()` (the existing whole-document OCR path for fully
scanned PDFs) was refactored to call the same `_ocr_pdf_page()` helper in a
loop, so there's one OCR code path instead of two near-duplicates.

If a flagged page's OCR *also* fails (Tesseract missing, or the render itself
produces nothing), that page is reported in `page_failures` and surfaces as
an `ingest_warning`, forcing `needs_review` on that document — consistent
with how a fully-failed whole-document OCR already behaved. A **successful**
per-page recovery is spliced in silently and does *not* force review, again
matching how a successful whole-document OCR recovery already behaved before
this change — this is a deliberate consistency choice, not an oversight.

## Verified result

Reprocessed the same file (`python src/pipeline.py --project sam-rfq-default
--file <path> --force`):

| | Before | After |
|---|---|---|
| Fields filled | 9 / 15 | **15 / 15** |
| Overall confidence | 0.94 | **1.0** |
| `agency` | `NAVAL AIR PACIFIC FLEET` (wrong org) | `NAVSUP FLTLOG CTR YOKOSUKA` (correct — matches page 1's "ISSUED BY" block) |
| `posted_date` | `null` | `2026-09-10` |
| `response_deadline` | `null` | `2026-09-15` |
| `naics_code` | `null` | `811121` |
| `contact_name` / `contact_email` | `null` / `null` | `SABRINA NICOLE MELSIOR` / `sabrinanicole.e.melsior.civ@us.navy.mil` |
| `set_aside` | `SMALL BUSINESS` (guessed from boilerplate) | `SMALL BUSINESS` (now backed by the actual `[X]` checkbox visible in the OCR'd render) |

That last row is a nice side effect: some checkboxes on government forms are
drawn as vector graphics with no associated text, invisible to
`pdfplumber.extract_text()` either way — but an OCR pass over the *rendered*
page can sometimes read the visual `X` mark, recovering information that was
never reachable through the native text layer at all, scanned or not.

## Known limitations / not done here

- **This one document was reprocessed to verify the fix.** The rest of the
  158-document `sam-rfq-default` corpus (and `defense-aviation`) was *not*
  bulk-reprocessed — some other documents likely have the same hybrid
  pattern and would benefit from a `--all --force` re-run, but that costs
  real time (each LLM extraction is ~20-35s) and wasn't requested.
- `MIN_PAGE_CHARS = 20` is a judgment call: low enough to not OCR pages that
  legitimately have sparse-but-real text (e.g. a mostly-blank divider page),
  high enough to catch a genuinely image-only page. It hasn't been tuned
  against a labeled set of edge cases.
- Still bounded by Tesseract's own limits (see `docs/OCR_VLM_OPTIONS.md`) —
  this fix makes sure the *right pages* get OCR'd, it doesn't make OCR itself
  more accurate on bad scans or handwriting.
