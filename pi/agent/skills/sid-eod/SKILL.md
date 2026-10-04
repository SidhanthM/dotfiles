---
name: sid-eod
description: >
  Draft end-of-day (EOD) status messages for Sid (Sidhanth) at iCYLON. Use this skill whenever
  Sid asks to write, format, or refine a "heading out", "end of day", or EOD update, even if
  phrased casually like "help me write today's message" or "format this for my boss". Also use
  when Sid shares raw notes, peer EOD messages, code, conversation logs, or Claude Code chat
  history and wants them shaped into his established EOD format.
---

# Sid's EOD Message Skill

## Who this is for

Sid is a software engineer at iCYLON (Reston, VA). He sends a daily status message to his team
at the end of each workday. This skill encodes the exact tone, format, and rules he has
established across many sessions so the agent produces consistent output without being
re-trained each time.

---

## Format Rules

### Structure
- Start with exactly one `Heading Out:` line and group bullets by **project area** using a plain-text section header (e.g. `IL5 Frontend:`, `IL5 Backend / Infrastructure:`, `COP:`, `GraphRAG:`). Collapse any repeated heading lines into the single top heading.
- Leave exactly one blank line **between** project-area sections; never add blank lines within a section or before/after the heading.
- Each bullet is a single physical line. Join any wrapped continuation lines and strip leading whitespace so every line starts at column 0.
- Each bullet is one idea. If a bullet needs the word "and" more than twice, split it.
- No numbered lists. No sub-bullets. No bold inside bullets.
- No preamble, no sign-off, no "Overall, significant progress was made..." wrap-up.
- Output flush left with no leading tabs or indentation. Every line starts at column 0.
- For substantial IL5 work that genuinely spans frontend and backend, use both sections and aim for 9+ concrete ✅ bullets when the day's completed work supports that count. Never pad or invent work to reach it.

### Symbol system
| Symbol | Meaning |
|--------|---------|
| ✅ | Done and working |
| 🚧 | In progress, not done |
| ⚠️ | Blocker, flag, or known limitation |
| ⏳ | Pending — waiting on someone else or a future dependency |
| ❌ | Not done — planned but explicitly deprioritized or missed |

### Tone
- Direct and slightly casual. Not stiff, not AI-polished.
- Name the problem or goal first, then what was done about it.
- Active voice. "Fixed X" not "X was fixed."
- Mention collaborators by name when work was joint (David, Luke, Kyu, Matthew, Sean, Adam, Andrew, Josh, Beommo).
- Use outcome-focused wording such as "Created a" instead of "built and deployed".
- Omit personal/internal tooling names such as `sync.sh` from EOD messages.
- Honest about blockers and limitations — they are signal, not failure.
- If something was just discussed or planned (not built), say so. Don't dress it up as a deliverable.

---

## DO

- Write one clear sentence per bullet
- Be specific about the mechanism when it matters (e.g. "SHA-256 hash for dedup" vs just "deduplication")
- Flag the reason for blockers and who's involved
- Use ⚠️ for limitations even on completed items if there's a known gap
- Match the verbosity to the complexity of the work — simple tasks get short bullets, architectural work gets a sentence or two

---

## AVOID

- Em dashes (—). Use a period or semicolon instead.
- "Overall", "significantly", "in summary", "it's worth noting"
- Passive voice
- AI-sounding wrap-up sentences
- Padding bullets with non-accomplishments
- Over-specific jargon that wasn't earned in the actual day's work
- Personal tooling details that don't describe the deliverable
- Quoting raw AI output verbatim — always rewrite in Sid's voice
- Investigation-narration verbs: "Confirmed X", "Found that X", "Verified X", "Traced X to Y" — these narrate a reasoning process, not a deliverable. If the underlying work doesn't survive being restated as a concrete action or output, cut the bullet entirely. Don't salvage weak bullets by rewording.
- Bullets about things that required no action. If the conclusion is "nothing needed to change", cut the bullet.
- Diagnosis-only bullets. Finding the cause of a problem is not progress unless paired with a fix or a concrete next step. "Figured out why X broke" with nothing shipped or unblocked is not a deliverable.
- Handoff or documentation bullets. Do not count writing an EOD handoff, runbook, or notes as a work check unless documentation was explicitly the requested deliverable. Prefer the operational action the document records.
- When in doubt, cut it. A short EOD with four strong bullets is better than eight bullets where three are filler.

---

## How to use this skill

1. **Output only this window's section(s).** Sid runs one chat per project area and combines the outputs at the end of the day. Each invocation should produce only the section(s) for work that happened in this conversation — one or two project-area blocks, not a full multi-project EOD. Sid will paste these together himself.
2. Sid will provide raw notes, peer EOD messages, code, or conversation logs (including Claude Code chat history).
3. Extract only what Sid actually did (not what teammates did unless collaborative).
4. Group by project area, apply the symbol system, write in his voice.
5. Do not add sections or bullets for things not mentioned. Do not pad.
6. Exclude any meta-conversation about Claude, AI tools, skills, or prompt setup — those are not work deliverables and should never appear in the EOD.
7. If Sid says "make it more human" or "less AI", strip any formal phrasing and shorten sentences.
8. If Sid edits and resubmits, carry those edits forward silently — no need to acknowledge each correction.
9. Output the EOD flush left with no leading tabs or indentation. Every line starts at column 0.
10. Always normalize spacing (single top heading, one blank line between sections, none elsewhere, one line per bullet) and file the EOD at `/Users/sadith/iCYLON/EOD/<YYYY-MM-DD>-eod.md` (today's date, e.g. `2026-08-25-eod.md`), keeping the emojis. If the file exists, append the new section(s) with one blank line separating from existing content.

Output the EOD message directly as plain text, ready to paste. No preamble, no commentary after.

---

## Team context (for naming and attribution)

- **David** — senior, graphRAG and backend systems; discusses IL5 workflow parallelization
- **Luke** — ontology, scraping pipelines, frontend
- **Kyu Chong** — manager/senior, sets priorities
- **Matthew** — manager/senior, IT infrastructure, drone work
- **Sean** — CAD, drone, Mission Orchestrator
- **Adam** — IT infrastructure; owns the il5ssp passthrough worker pattern
- **Andrew** — SSP generator worker (with Josh)
- **Josh** — SSP generator worker (with Andrew)
- **Beommo** — documentation, infrastructure

## Key project areas Sid works on

- **IL5 Frontend** — querywriter_pipeline widget work: Create Project (manifest ingest, OS override), Scan/View, SCC report rendering, Quick Scan, dashboard
- **IL5 Backend / Infrastructure** — gateway server (session_server, tasks), Celery worker fleet (create_project, ssp, scan, stig, poam), Redis broker/data servers, IL5 skeletons
- `graphRAG_tool_crawl` / `graphRAG_smart_crawl` — conversational graph RAG system
- NK Ontology — North Korea entity extraction pipeline mirroring the health ontology architecture
- NK Scraping — Playwright-based scrapers for Naenara, 38 North, KCNA Watch, NK Leadership Watch
- Graph Orchestration (Graph Orch) — frontend UI and backend for graph-based workflows
- Health Ontology — hierarchical medical entity extraction pipeline
- IT / Infrastructure — LDAP, Authelia, Kantech, SSL, NAS, netplans, LAGs, Mac Studios setup
- COP — common operating picture platform (power plants, bunker detection)
- SWE Interviewing — behavioral and technical interview process for software engineering candidates
- VTOL Drone — design review and advisory input

---

## Canonical Example

```
IL5 Frontend:

✅ Replaced Create Project's manual IP list and shared username/password with a manifest dropzone that takes CSV (with or without header) and JSON, mirroring the facial-recognition upload flow.
✅ Added a per-machine OS selector that defaults to Auto-detect with per-IP overrides saved as osOverride on each machine record.
✅ Widened the Scan/View node and added a Quick-Scan-style face with score, Passed/Failed/Total, and CAT fail counts.

IL5 Backend / Infrastructure:

✅ Set up the create_project worker on 192.168.73.93 following Adam's il5ssp passthrough pattern so it emits the exact projectObject the frontend builds.
🚧 Set up the il5_backend/il5_worker skeleton in the gateway server; uncommitted and not deployed yet.
✅ Helped Andrew and Josh get the SSP generator worker on 72.250 live: fixed the launcher so celery launches via absolute path instead of dying on "celery: not found", and pointed it at the Zeus broker and data Redis.
```
