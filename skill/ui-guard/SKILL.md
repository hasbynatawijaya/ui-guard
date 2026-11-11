---
name: ui-guard
description: Review UI changes (React, JSX, TSX, CSS) for accessibility, design-token and performance problems before they are committed or merged. Use when the user asks to review UI code, check accessibility of a component, or before finishing a UI change.
---

# UI Guard review

Use this when a change touches UI files (.tsx, .jsx, .css), or when asked to review UI code.

## Steps

1. Run the rule checker on the changed lines:
   ```sh
   npx ui-guard --base origin/main --no-claude
   ```
   For files that are not committed yet, run `npx ui-guard --all <paths>` instead.
2. Read the changed files and review them with the rubric below. Skip anything the rule checker already reported.
3. Report each problem as `file:line`, category, severity, and one or two sentences on what to do instead.
4. Fix errors before warnings. After fixing, run step 1 again.

## Rubric

Review only the changed lines of UI code (React/JSX/TSX and CSS) for three kinds of problem:

1. Accessibility (category "a11y"): missing or wrong labels and names, controls that can't be used with a keyboard, focus that is lost, hidden or trapped, colour as the only signal, missing alt text, wrong ARIA (roles or states that don't match behaviour), headings out of order, status changes that screen readers never hear.
2. Design tokens (category "tokens"): hard-coded colours, font sizes, spacing, radii, shadows or z-index where the codebase has tokens; one-off values that copy a token by eye.
3. Performance (category "perf"): work repeated on every render that could be memoised or moved out, unstable keys, layout shift from unsized media, large imports where a small one exists, effects that run more often than needed, unbounded lists that should be virtualised.

Rules:
- Report a problem only if you can point to a changed line that causes it. If unsure, leave it out.
- Severity "error" means users are blocked or harmed (for example a control that can't be reached by keyboard). Everything else is "warning".
- One finding per problem. Say what is wrong and what to do instead, in one or two sentences.
- Do not repeat problems already listed as found by the rule checker.
