\# Project rules



\## Scope



\- Stay strictly within the requested task.

\- Do not modify, refactor, or clean up unrelated code.

\- Reuse existing components, utilities, and patterns before creating new ones.

\- Do not add or update dependencies unless required for the requested task.

\- Do not modify generated files unless necessary.



\## Context efficiency



\- Start by inspecting only the files directly relevant to the task.

\- Expand the search to other files only when necessary.

\- Do not scan the entire repository by default.

\- Do not inspect dependency or generated folders unless required.



Ignore by default:

\- node\_modules

\- .next

\- dist

\- build

\- coverage

\- generated



\## Testing



\- During implementation, run only tests directly related to the changed code.

\- Do not repeatedly run the full unit test suite after each edit.

\- Do not repeatedly run the full browser/E2E suite.

\- Run broader tests only once near final verification and only when justified by regression risk.



\## Browser testing



\- Test only browser scenarios affected by the change.

\- Do not run the same scenario across every language and viewport unless the behavior can actually differ.

\- Test mobile only when the change can affect responsive behavior.

\- Test multiple languages only when the change involves translated text, locale-specific behavior, formatting, routing, or localization.

\- Avoid redundant screenshots.

\- Prefer one representative desktop viewport and one representative mobile viewport when visual verification is needed.



\## Verification



\- Run TypeScript checks only when relevant to the changed code or once near completion.

\- Run lint only when relevant or once near completion.

\- Prefer targeted checks before full-project checks.

\- Keep terminal output concise.

\- Prefer failure summaries and relevant error lines over complete logs.



\## Agents and tools



\- Do not use subagents for small or straightforward tasks.

\- Use subagents only when the task contains genuinely independent work that benefits from parallel execution.

\- Do not use external tools, MCP servers, browser automation, or computer-use tools unless they are useful for the requested task.

\- Avoid unnecessary repository exploration.



\## Efficiency



\- Prefer the smallest correct change.

\- Do not perform speculative improvements.

\- Do not create additional documentation unless requested.

\- Stop once the requested behavior is implemented and relevant verification passes.

\- If a full test suite would be expensive, ask or explain why it is necessary before running it unless the task clearly requires it.



\## Communication



\- Keep progress updates concise.

\- Do not narrate routine actions in detail.

\- Do not repeat information already established in the conversation.



Final response should contain only:

\- what changed;

\- relevant tests/checks performed;

\- deployment status if relevant;

\- remaining issue or limitation, if any.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
