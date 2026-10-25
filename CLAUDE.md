# Uchiro Store V3 — Project Instructions & Operating Rules

## A. Follow the User's Actual Request
- Work only on the feature, bug, or files relevant to the current request.
- Do not expand a small bug fix into a project-wide refactor or audit.
- Do not add optional improvements, new features, abstractions, or files unless requested or strictly necessary.
- If the requested behavior already works, leave it unchanged and report that no modification was needed.
- Never silently reinterpret the user's requirements.

## B. Do Not Repeat Work Unnecessarily
- Inspect relevant files and existing changes before editing.
- Find the root cause before changing code: identify the actual broken behavior and its responsible function before editing.
- Never remove and recreate an existing working button, component, function, or translation without a specific technical reason.
- Never add duplicate buttons, handlers, callback definitions, translation entries, or business logic.
- Before editing, inspect the current implementation and relevant diff.
- Before making another edit, inspect the result of the previous edit.
- Do not undo a working fix without evidence that it is incorrect.
- Reuse existing implementations rather than creating competing implementations.
- Do not keep repeating the same search, file reading, test, or edit.

## C. Prevent Endless Debugging Loops
- Make the smallest change that correctly fixes the identified root cause.
- Run one focused test or check after a focused fix.
- If the same failure occurs, inspect its actual error and modify the approach based on evidence.
- Allow at most two focused attempts to resolve the same failure.
- If the issue remains unresolved after two attempts, stop editing and report the blocker.
- If files keep changing back and forth, stop and inspect the diff instead of continuing.
- Never make another edit merely to appear productive.
- Do not start a new full-project audit after context compaction or when a new conversation begins. Recover progress from the current files and relevant existing notes.

## D. Control Context and API Usage
- Prefer targeted search and small file excerpts. Never read large files in full when a targeted search or small excerpt is sufficient.
- For a small bug, start with at most 3 directly relevant source files. Inspect more only when evidence proves it is necessary.
- Do not scan the repository, read dozens of files, or run broad test suites unless explicitly requested.
- Do not print entire large files or enormous logs when only a few relevant lines are needed.
- Do not repeatedly feed previous full reports or the entire project into a new prompt.
- Do not run all tests after every minor change.
- Run focused tests first; run broader checks only when the change justifies them or before an explicitly requested release check.
- Do not spawn subagents or parallel investigations for a simple task.
- Avoid creating temporary scripts, documentation, memory files, or helper files unless genuinely necessary.
- Do not spend repeated turns re-verifying already established facts without new evidence.

## E. Preserve the Project and Existing Changes
- Never use destructive Git commands such as `git reset --hard` or `git clean -fd`.
- Never discard unexplained changes or overwrite user work.
- Never clear or recreate a database to fix a display or connection problem.
- Never switch production databases based on guesses, fake successful payments, or weaken security to make a test pass.
- Never run destructive migrations against production.
- Never print secrets or environment-variable values.
- Never replace a real integration with fake success responses.
- Never weaken security to make a test pass.
- Never commit, push, merge, or deploy unless the user explicitly authorizes that action.
- Protect the existing Git branch, database, order history, inventory, customer records, and uploaded files.

## F. Make Verification Proportional to the Change
- Choose tests related to the modified behavior.
- Do not claim a test passed unless it actually ran and passed.
- Do not claim the entire project is verified after running only one focused test.
- Do not rewrite tests merely to make incorrect code appear correct.
- If the environment or a missing external service prevents verification, explain the precise limitation.
- Review the relevant diff for accidental duplicate or unrelated changes.

## G. Respect Uchiro Store V3 Product Requirements
When future tasks concern localization, always preserve the established requirement:
- **Khmer selected**: all customer-facing explanatory messages in the Telegram bot and mini app use simple, natural Khmer.
- **English selected**: all customer-facing explanatory messages use clear English.
- **Action-button labels**: remain in English in both languages.
- Use a normal, readable font that correctly renders Khmer.
- Avoid duplicate emojis and duplicate notifications.
- Preserve existing pricing, inventory, customer data, checkout security, and business rules unless the user explicitly requests a change.

Do not repeatedly audit these requirements during unrelated tasks. Verify only the relevant portion unless the user specifically requests a complete localization audit.

## H. Gacha Honesty & Probability Rules
- Preserve the existing Store appearance.
- Make rare prizes harder to win when requested.
- Enforce one spin per action.
- Ensure displayed odds accurately match actual server-side probabilities. Never show misleading probabilities.

## I. Finish Each Task and Stop
- Provide a brief report of the root cause, actual files changed, and focused verification results (and any unresolved issues).
- Keep the final report concise.
- If no code change is needed, say so.
- When the requested scope is complete, STOP and wait for the user's next instruction.
- Do not automatically begin another task or full-project audit.
