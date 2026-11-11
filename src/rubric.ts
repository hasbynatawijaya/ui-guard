// The review rubric. The Claude Code skill (skill/ui-guard/SKILL.md) contains
// the same text; a test keeps the two identical.
export const RUBRIC = `Review only the changed lines of UI code (React/JSX/TSX and CSS) for three kinds of problem:

1. Accessibility (category "a11y"): missing or wrong labels and names, controls that can't be used with a keyboard, focus that is lost, hidden or trapped, colour as the only signal, missing alt text, wrong ARIA (roles or states that don't match behaviour), headings out of order, status changes that screen readers never hear.
2. Design tokens (category "tokens"): hard-coded colours, font sizes, spacing, radii, shadows or z-index where the codebase has tokens; one-off values that copy a token by eye.
3. Performance (category "perf"): work repeated on every render that could be memoised or moved out, unstable keys, layout shift from unsized media, large imports where a small one exists, effects that run more often than needed, unbounded lists that should be virtualised.

Rules:
- Report a problem only if you can point to a changed line that causes it. If unsure, leave it out.
- Severity "error" means users are blocked or harmed (for example a control that can't be reached by keyboard). Everything else is "warning".
- One finding per problem. Say what is wrong and what to do instead, in one or two sentences.
- Do not repeat problems already listed as found by the rule checker.`;
