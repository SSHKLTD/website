---
name: radar
description: Daily Hong Kong PR-incident radar for SSHK — fetch, triage, enrich, draft, and republish the monitoring artifact. Run when asked to "run the radar" or by the scheduled routine.
---

# SSHK Radar — daily run

You are producing an editorial radar for Social Strategy Hong Kong (SSHK), a crisis-communications and social agency. The output is (a) a ranked list of Hong Kong incidents worth commenting on, and (b) publish-ready draft posts for the top case that a founder will hand-edit and post themselves. **You never post anywhere and never commit to the website repo.**

## Inputs
- `ARTIFACT_URL` — given in the routine prompt. The monitoring page to read and republish.
- Today's date (HKT). Monday runs also produce the weekly long-form.

## Step 1 — Fetch
```
python3 .claude/skills/radar/fetch.py --days 2 --out /tmp/radar_raw.json
```
Read the printed table. Expect 60–150 items, mostly noise.

## Step 2 — Triage (headlines only, no fetching yet)
Score each headline 0–5 on each criterion; keep items scoring ≥3 on ALL of the first four and 5 on the fifth:
1. **Hong Kong** — the actor or the audience is HK (Taiwan/mainland-only stories: 0).
2. **Organisation, not individual** — a brand, company, institution, public body, NGO, or public figure *acting in an official role*. Private individuals: 0.
3. **A communication response exists, or clearly should** — a statement, apology, clarification, silence-when-a-statement-was-expected.
4. **Transferable lesson** — a corporate comms head at a large HK organisation could learn something for their own war room.
5. **Safe to comment** (5 = pass, 0 = exclude): exclude anything involving minors' identities, sexual offences, cases under active trial, named private individuals, or partisan political positioning. Analyse *statements*, never people.

Also flag **updates to cases already on the artifact** (second waves, follow-up statements) — these are often more valuable than new cases.

Rank survivors. Typically 2–6 survive.

## Step 3 — Enrich the top 3
For each: `WebSearch` the exact headline to find the **original publisher URL** (never use the Google News redirect link — it lands on an interstitial). Then `WebFetch` 2–4 articles per case with this prompt shape:
> Extract facts only, in the original language where quoted. (1) publish date/time (2) timeline by date (3) every statement by an organisation, with date and VERBATIM key sentences (4) what made it public (5) numbers. No summary, no interpretation.
`stheadline.com` redirect-loops — use `singtaousa.com` mirrors or hk01/on.cc instead.

Build a dated timeline with verbatim quotes. If two sources disagree, note it; if you cannot verify a claim, do not use it.

## Step 4 — Draft (top case only)
Every day: **LinkedIn 中文**, **LinkedIn English**, **Threads**.
Mondays additionally: **本週輿情 長文** for the week's strongest case (may be an earlier day's case).

### Voice (SSHK)
- Positioning: "We started as readers, not marketers." / "Make waves. Calm waves." Framework: **Read → Score → Flag → Handle**.
- Analyse the *statements*, statement by statement, with a score and a one-line reason each. Never the incident's morality.
- Find the sentence that made it worse and the sentence that made it better. Name the pattern ("我們試過" clauses, premature framing like「一時」, silence on a second wave, parent-vs-subsidiary sequencing).
- End with 2–3 transferable rules a corporate comms head can use tomorrow.
- Close with the stance line: 我們對事件無立場,我們看的是聲明 / We take no view on the incident. We read statements.
- Chinese: 書面語 with natural HK flavour for LinkedIn/long-form; Threads may be Cantonese. English: written natively for regional/MNC comms heads, never translated.
- Mark any sentence that asserts SSHK's own experience or judgement with `[確認]` so the author owns it before posting.

### Structure
- Long-form: hook (one fact) → timeline, one statement per subsection, each scored → 「我們會怎樣做」3 rules → stance line → footer *本文只評論各機構公開發表的聲明,不涉及任何個別人士*.
- LinkedIn 中: ≤300 字. Hook line → scored bullets → 3 rules → stance line → 3 hashtags.
- LinkedIn EN: ≤250 words, same shape.
- Threads: ≤120 字, one lesson.
- Always include a **發佈前檢查** list and a **來源** list with real publisher URLs.

## Step 5 — Republish the artifact
1. `Artifact read` on `ARTIFACT_URL`. The page embeds its data in `<script type="application/json" id="radar-data">`. Parse it.
2. Append today's run: `{date, candidates:[{rank,case,org_type,score,reason,is_update}], drafts:{linkedin_zh, linkedin_en, threads, longform?}, sources:[...]}`. Keep the last 30 days; drop older.
3. The page renders itself from that JSON. **Replace only the contents of the `#radar-data` script block**; leave every other byte of the HTML untouched (no restyling, no new sections). Publish with `url: ARTIFACT_URL`, `label: "radar-YYYY-MM-DD"`. Do **not** pass `favicon`.
4. If nothing survived triage, still republish with an empty candidates list for the day and a one-line note — the founder needs to know it ran.

## Guardrails
- Never post to LinkedIn/Threads/anywhere. Never commit or push to any repo. Never create new artifacts — republish the given URL only.
- Never name private individuals or minors. Quote organisations' statements verbatim; never paraphrase a quote as if verbatim.
- Total budget: ≤12 WebFetch calls per run. If the fetch script errors on every query, republish with an error note rather than inventing items.
