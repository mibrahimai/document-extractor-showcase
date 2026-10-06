# Fix: DOCX checkbox form fields silently dropped, and unreadable even when kept

## The bug

`data/raw/7e3e49e0deb3410caac0196ec454a88f_647_LRS_Bird_Dropping_Removal/attachment_3.docx`
has a "Type of Set-Aside (Check One)" table with six options (None, Small
Business, Small Disadvantaged, Woman Owned, HUBZone, Section 8(a)) and one
box checked: **Small Business**. `set_aside` always came back `null` —
"not explicitly provided in the document" — even though the value is right
there in the source file.

## Root cause #1 — the checked cell was never extracted at all

`src/ingest.py`'s `extract_docx()` used `python-docx`'s `table.rows[i].cells`,
which only walks `<w:tc>` elements that are **direct children** of `<w:tr>`.
Dumping the raw `word/document.xml` for this table shows why that's not
enough here:

```xml
<w:tr>
  <w:tc>...☐...</w:tc>                                    <!-- None -->
  <w:sdt>                                                   <!-- Small Business -->
    <w:sdtPr><w14:checkbox><w14:checked w14:val="1"/>...
    <w:sdtContent><w:tc>...☒...</w:tc></w:sdtContent>
  </w:sdt>
  <w:tc>...☐...</w:tc>  <w:tc>...☐...</w:tc>
  <w:tc>...☐...</w:tc>  <w:tc>...☐...</w:tc>
</w:tr>
```

The checked box is a **content-control checkbox** (`<w:sdt>` with a
`<w14:checkbox>`), and its `<w:tc>` sits one level deeper than its five
plain-text siblings — wrapped inside `<w:sdt><w:sdtContent>` instead of being
a direct child of `<w:tr>`. `row.cells` doesn't see it. Extracted text before
the fix: `☐ | ☐ | ☐ | ☐ | ☐` — **five** boxes for six columns, all unchecked,
because the one cell that actually mattered (the checked one) was silently
dropped rather than misread.

This is the DOCX-world equivalent of the PDF page-1-is-an-image issue in
`docs/PAGE_LEVEL_OCR_FALLBACK.md` — real answer, stored in a structured
form-control layer the naive text extractor doesn't walk into.

**Fix**: walk every `<w:tc>` in the row at any depth (`.//w:tc` via lxml),
not just direct children, pulling each cell's text straight from its `<w:t>`
run nodes. This finds the sdt-wrapped cell in the same position it visually
occupies, so it lines up with its header column instead of vanishing. Fixed
in `extract_docx()` (`src/ingest.py`).

## Root cause #2 — even correct, the model couldn't align two stacked rows

Fixing #1 alone wasn't enough. With the real data flowing through, the
extracted text looked like this — completely correct, checked box in the
right column:

```
None (*Mandatory Source) | Small Business | Small Disadvantaged | Woman Owned | HUBZone | Section 8(a)
☐ | ☒ | ☐ | ☐ | ☐ | ☐
```

Reprocessing with just fix #1 still returned `set_aside: null`. Verified the
model received this text intact (document is 4,536 chars total, nowhere near
the truncation limit) — it simply couldn't reliably treat two separate lines
as column-aligned and pick out which label the 2nd symbol belongs to. This
is a real LLM reasoning limit, not an extraction gap, and prompting around it
reliably is harder than just not asking for that inference in the first
place.

**Fix**: `extract_docx()` now detects this specific pattern — a row of pure
checkbox glyphs immediately following a same-width row of labels — and
collapses it into one line of explicit pairs before the label row and glyph
row are ever separately emitted:

```
None (*Mandatory Source): unchecked | Small Business: CHECKED | Small Disadvantaged: unchecked | Woman Owned: unchecked | HUBZone: unchecked | Section 8(a): unchecked
```

No column-alignment inference is asked of the model anymore — the answer is
inline with its own label.

## Verified result

Reprocessed the same file (`python src/pipeline.py --project sam-rfq-default
--file <path> --force`):

| | Before | After |
|---|---|---|
| `set_aside` | `null` ("not explicitly provided") | **`Small Business`** (confidence 1.0) |

## Known limitations / not done here

- The checkbox-collapse heuristic (`_CHECKBOX_CHECKED` / `_CHECKBOX_EMPTY` in
  `src/ingest.py`) recognizes `☒ ☑ ■ x X` as checked and `☐ □ - (empty)` as
  unchecked. A form using a different convention (e.g. a "Yes"/"No" text
  column instead of glyphs) wouldn't trigger the collapse — it would just
  fall back to the old two-row output, which still isn't reliably readable
  by the model per root cause #2.
- Only this one document was reprocessed to verify the fix; other DOCX forms
  in the corpus with the same checkbox-content-control pattern weren't
  bulk-reprocessed.
- Same caveat as the PDF fix: this makes sure the *right* data reaches the
  model in a *readable* shape — it doesn't change what the model does with
  clearly-presented data it still gets wrong for other reasons.
