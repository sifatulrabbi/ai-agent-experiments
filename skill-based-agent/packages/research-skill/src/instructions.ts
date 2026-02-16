export const description =
  "Structured multi-phase research skill. Guides the agent through a disciplined research methodology — clarifying intent, planning, broad parallel search via sub-agents, deep extraction, and final report synthesis — using existing web search, fetch, and sub-agent tools.";

export const instructions = `# Research Skill

You have access to a structured research methodology. This skill provides NO additional tools — it teaches you how to use your existing tools (WebSearchGeneral, WebSearchNews, WebFetchUrlContent, SpawnSubAgent, and workspace tools) in a disciplined, multi-phase research workflow.

Follow these phases sequentially. Do not skip phases.

---

## Phase 1 — Clarify Intent

Before searching, understand what the user actually needs.

1. Analyze the user's research request carefully.
2. Ask 2–5 clarification questions to narrow:
   - **Scope**: How broad or narrow? (e.g., "all renewable energy" vs. "solar panel efficiency trends in 2024–2025")
   - **Audience**: Who is this for? (executive summary, technical deep-dive, academic, casual?)
   - **Depth**: Surface overview or exhaustive analysis?
   - **Recency**: Does this need the latest data, or is historical context fine?
   - **Output format**: Report, bullet points, comparison table, slide-ready?
3. Wait for the user's answers before proceeding.

---

## Phase 2 — Plan & Save

Create a research plan and persist it.

1. Generate a short kebab-case name for this research (e.g., "solar-efficiency-trends").
2. Create a hash-based working directory: \`/tmp/research-[name]/\`
3. Write \`/tmp/research-[name]/plan.md\` containing:
   - **Topic**: One-sentence statement of the research question
   - **Scope**: Boundaries — what's included and excluded
   - **Target queries**: 5–10 distinct search queries covering different angles
   - **Output format**: What the final deliverable looks like
4. Share the plan with the user and confirm before proceeding.

---

## Phase 3 — Broad Search (fan-out with sub-agents)

Run at least 5 parallel search rounds to gather diverse sources.

1. From your plan's target queries, group them into 5+ batches.
2. Spawn 5+ sub-agents in parallel using \`SpawnSubAgent\`. Each sub-agent should:
   - Use \`WebSearchGeneral\` or \`WebSearchNews\` with a distinct query angle
   - Summarize findings in 3–5 bullet points
   - List the top 1–3 most relevant URLs with brief descriptions
   - Use \`outputStrategy: "tmp-file"\` so results are written to disk
3. Each sub-agent writes its output to \`/tmp/research-[name]/searches/round-N.md\`
4. After all sub-agents complete, read each round file and compile a master URL list.

**Sub-agent goal template:**
\`\`\`
Search for: [specific query]
Summarize the top findings in 3–5 bullet points.
List the top 1–3 most relevant URLs with a one-line description of each.
Write your output to /tmp/research-[name]/searches/round-[N].md
\`\`\`

---

## Phase 4 — Deep Extraction (fan-out with sub-agents)

Extract detailed information from the best sources found in Phase 3.

1. Collect all URLs from the round files. Deduplicate and rank by relevance.
2. Select the top 8–15 URLs for deep extraction.
3. Spawn sub-agents in parallel, each responsible for 1–3 URLs:
   - Use \`WebFetchUrlContent\` to retrieve full page content
   - Extract and summarize key information in dense format (maximize info, minimize tokens)
   - Retain specific data points: numbers, dates, names, quotes
   - Note any contradictions or caveats
   - Use \`outputStrategy: "tmp-file"\` so results are written to disk
4. Each sub-agent writes to \`/tmp/research-[name]/summaries/source-N.md\`

**Sub-agent goal template:**
\`\`\`
Fetch and deeply analyze these URLs: [url1, url2, ...]
For each URL:
- Extract key facts, data points, and arguments
- Note specific numbers, dates, names, and direct quotes
- Flag any contradictions or limitations
Write a dense summary to /tmp/research-[name]/summaries/source-[N].md
\`\`\`

---

## Phase 5 — Final Report

Synthesize all extracted information into a comprehensive deliverable.

1. Read all files in \`/tmp/research-[name]/summaries/\`
2. Cross-reference findings across sources to identify:
   - Consensus points (multiple sources agree)
   - Contradictions or debates
   - Data gaps or areas needing further research
3. Write a comprehensive final report that includes:
   - **Executive Summary**: 3–5 sentence overview
   - **Key Findings**: Organized by theme or question, not by source
   - **Key writeup**: For each of the elements of the research write:
     - **Detailed Analysis**: In-depth discussion with supporting evidence
     - **Contradictions & Caveats**: Where sources disagree or data is limited
     - **Sources**: Numbered citation list with URLs
4. Write the final report to the user's workspace as a visible deliverable.

---

## Guidelines

- **Always fan out**: Use sub-agents for parallel work. Never run 5+ searches sequentially.
- **Persist intermediate work**: Write to /tmp so progress is not lost if context is long.
- **Dense summaries**: When extracting, keep information density high. Retain facts, cut fluff.
- **Cite everything**: Every claim in the final report should trace back to a source URL.
- **Ask before proceeding**: Confirm the plan (Phase 2) with the user before spending effort on searches.
- **Adapt scope**: If initial searches reveal the topic is broader/narrower than expected, revise the plan.`;
