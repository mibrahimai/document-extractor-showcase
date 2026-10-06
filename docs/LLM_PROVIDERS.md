# LLM providers — usage guide

Run the same document-extractor API + web UI with **local Ollama** (office GPU) or **free cloud** (Google AI Studio / Groq) when you’re on ~8 GB VRAM at home.

Only **one** provider answers each call, but with `LLM_PROVIDER=auto` the app can **fail over** Google → Groq on rate limits without you editing `.env`.  
Triage, extract, and vendor-email drafts all use that chain.

---

## Quick usage (how to switch)

### 1. Put keys in `.env` (keep them filled even when unused)

```env
# Active backend: ollama | google | groq | auto
LLM_PROVIDER=auto

OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:14b

GOOGLE_AI_API_KEY=your_ai_studio_key
GOOGLE_AI_MODEL=gemini-3.8-flash

GROQ_API_KEY=your_groq_key
GROQ_MODEL=openai/gpt-oss-120b
```

Suggested Google key name in AI Studio: `doc-extractor-home-8gb`  
Keys: [AI Studio](https://aistudio.google.com/apikey) · [Groq](https://console.groq.com/keys)

For home with both free keys filled, prefer **`LLM_PROVIDER=auto`** (Google → Groq on rate limit).

Never commit `.env` or `deploy/gpu-relay/CREDENTIALS.txt`.

### 2. Restart the API after changing provider

```bat
REM If using the Windows service:
D:\Dev\list\document-extractor\deploy\gpu-relay\bin\restart-api-as-admin.bat

REM Or restart uvicorn yourself, then:
curl http://127.0.0.1:8787/api/health
```

You want something like:

```json
{"ok":true,"llm":{"provider":"auto","primary":"google","fallbacks":["groq"],"model":"gemini-3.8-flash","reachable":true,"model_available":true}}
```



### 3. Smoke-test

Open a project → **Test a file** with a small PDF/TXT.

---



## When to use which


| Situation                          | Set `LLM_PROVIDER=` | Why                                         |
| ---------------------------------- | ------------------- | ------------------------------------------- |
| Office / strong GPU / private docs | `ollama`            | Fast enough, data stays local, no cloud RPM |
| Home / both free keys filled       | `auto`              | Google first; Groq catches 429/503          |
| Home / Google only                 | `google`            | Strong extraction on free Flash             |
| Google rate-limited, no auto       | `groq`              | Alternate free quota; very fast Llama       |
| Need max privacy                   | `ollama` only       | Cloud sends document text off-machine       |


**Typical day:** office → `ollama`. Home → `auto` (or `google`). With `auto`, you usually don’t restart when Flash hits RPM — Groq takes the next call.

---



## Gemini Flash limits (what matters for us)

Google does **not** publish a fixed free-tier RPM table in the public docs; live numbers are on  
[AI Studio → Rate limits](https://aistudio.google.com/rate-limit) (per project, per model).

Official concepts: [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)


| Dimension | Meaning                                    |
| --------- | ------------------------------------------ |
| **RPM**   | Requests per minute                        |
| **TPM**   | Input tokens per minute                    |
| **RPD**   | Requests per day (resets midnight Pacific) |


**What we measured on this key** (free tier, `gemini-3.8-flash`): about **20 RPM**.  
Hitting more returns `429` / `RESOURCE_EXHAUSTED` with a “retry in Xs” hint. Our client backs off and retries a few times (capped so the API worker doesn’t hang).

### Is that good enough for document-extractor?

**Yes for personal / R&D home use.** One file usually costs **2 LLM calls** (triage + extract), sometimes +1 for email draft.


| Workload                      | Rough calls | Fits in ~20 RPM?                                     |
| ----------------------------- | ----------- | ---------------------------------------------------- |
| Test 1 file                   | ~2          | Comfortable                                          |
| Batch 5–8 files               | ~10–16      | OK if not slammed at once                            |
| Batch 15+ files in one minute | 30+         | Will 429 — slow the batch or switch to Groq / Ollama |


**Reliability vs quality (our experience):**


|                    | Google Flash (`gemini-3.8-flash`)           | Groq (Llama 3.3 70B)                      | Ollama local 14B                |
| ------------------ | ------------------------------------------- | ----------------------------------------- | ------------------------------- |
| Extraction quality | Excellent on our cars smoke test (conf 1.0) | Usually strong; can differ on edge fields | Good; weaker on long/noisy docs |
| Speed              | Fast–medium (thinking tokens add latency)   | Often fastest                             | Depends on GPU                  |
| Free limits        | Tight RPM/RPD                               | Also limited (see Groq console)           | Your hardware                   |
| Reliability        | Occasional 503 “high demand” + 429          | Generally stable when under quota         | Best if GPU is up               |
| Privacy            | Cloud                                       | Cloud                                     | Local                           |


**Verdict:** Google Flash is the **best default at home** for quality and **long documents**. Groq is a **small-doc / burst backup** only on free tier (~8k TPM — a book PDF will not fit). Ollama is the **most reliable unlimited** option when the office GPU (or NatCat relay) is available — no cloud RPM.

**What auto does now (better than raw fail-over):**
1. Prefer Google; on 429 wait and retry (honors “retry in Xs”).
2. If still failing, hand off to Groq **after shrinking** the prompt (start/middle/end sample) so you don’t get a useless 413.
3. Groq 429 also waits briefly instead of dying immediately.

There is **no free “unlimited” cloud API**. Paid Google Tier 1+ or local Ollama is the path for heavy books.

---



## Parallel Google + Groq? Multi-key “keep context”?

### 1. How Google knows keys belong to one project

When you click **Create key** in AI Studio you pick a project (e.g. **Default Gemini Project**).  
Google embeds that project ID in the key. Quotas (RPM / TPM / RPD) are billed and limited **per Google Cloud project**, not per key name.

So:

- Two keys under **Default Gemini Project** → **same** ~20 RPM pool.  
- A second key does **not** double your free limit.  
- To get a separate quota you’d need a **different Google Cloud project** (and usually a different Google account / billing). Even then, free-tier abuse filters may still apply.

You can confirm the project on [AI Studio API keys](https://aistudio.google.com/api-keys) and live RPM on [Rate limits](https://aistudio.google.com/rate-limit).

### 2. Google + Groq “simultaneously” (failover — yes, now built)

We do **not** call both APIs at once for the same file (that would waste quota and produce conflicting JSON).

We **do** support **automatic failover** so when Flash hits 429/503, Groq takes the **same** triage/extract prompt. When Groq is limited later, the **next** call starts at Google again (quotas recover on their own clocks). No chat session to lose — every call already includes the full document.

```env
LLM_PROVIDER=auto
GOOGLE_AI_API_KEY=...
GROQ_API_KEY=...          # required for backup
GOOGLE_AI_MODEL=gemini-3.8-flash
GROQ_MODEL=openai/gpt-oss-120b
```

Restart the API. Health shows `provider: auto` and a `chain` of backends.

**How noticeable?** One failed Google attempt then Groq — usually an extra ~1–3 seconds on that call, then the UI continues. Metrics may include `failover_from` / `failover_chain` when a backup was used.

Alternative (pin Google, backup Groq):

```env
LLM_PROVIDER=google
LLM_FALLBACK=groq
```

Until `GROQ_API_KEY` is filled, `auto` behaves like Google-only.

### 3. Extra Google keys vs failover

| Idea | Works? |
|------|--------|
| 3 Google keys, same project | No — shared quota |
| Google + Groq failover (`auto`) | Yes — separate companies, separate free limits |
| Parallel both on one file | No — don’t |
| Lose document “context” when switching | No — each call is stateless |

---



## Provider detail snippets



### Office — Ollama

```env
LLM_PROVIDER=ollama
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:14b
```



### Home — Google AI Studio

```env
LLM_PROVIDER=google
GOOGLE_AI_API_KEY=...
GOOGLE_AI_MODEL=gemini-3.8-flash
```

- Uses native Gemini `generateContent` (same family as [get-started](https://aistudio.google.com/docs/get-started)).
- Older `gemini-2.0-flash` is retired (404) for new keys.



### Home backup — Groq

```env
LLM_PROVIDER=groq
GROQ_API_KEY=...
GROQ_MODEL=openai/gpt-oss-120b
```

(People often say “Grok”; our env name is **Groq**.)  
Docs: [Overview](https://console.groq.com/docs/overview) (OpenAI-compatible base `https://api.groq.com/openai/v1`) · [Models](https://console.groq.com/docs/models) · [Limits](https://console.groq.com/settings/limits).

Free-tier tip: `llama-3.3-70b-versatile` is often **Enterprise-only**. Use `openai/gpt-oss-120b` (default) or faster `openai/gpt-oss-20b`.

---



## What stays the same regardless of provider


| Shared                      | Different             |
| --------------------------- | --------------------- |
| Web UI, projects, templates | Where the model runs  |
| Ingest / OCR pipeline       | Rate limits & privacy |
| DB, exports, validation     | Latency & JSON style  |


---



## Checklist

- [ ] Keys in `.env` (Google and/or Groq)
- [ ] `LLM_PROVIDER` set for this machine
- [ ] API restarted
- [ ] `/api/health` → `reachable: true`
- [ ] Test a file on a small sample
- [ ] If 429 → wait ~1 minute or switch provider