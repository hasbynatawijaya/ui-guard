# UI Guard

Reviews UI code in pull requests (React TSX/JSX and CSS) for **accessibility**, **design-token** and **performance** problems, and reports only what the pull request adds.

It is meant for teams where AI assistants write a lot of UI code. That code usually works, and often has the same blind spots: clickable `div`s, icon buttons with no name, inputs labelled only by a placeholder, hard-coded colours, array indexes as keys.

## How it works

Two layers, one report:

1. **Rule checks.** Deterministic, fast, free. TSX/JSX is parsed with the TypeScript compiler API; CSS with a small parser that keeps line numbers. 14 rules (list below). No API key needed.
2. **Claude review (optional).** When `ANTHROPIC_API_KEY` is set, the changed files go to Claude with the same rubric, and it returns findings as structured output. Problems that need judgment, such as colour as the only signal, missing live regions or dialog semantics, belong here.

Both layers only report problems on **changed lines**, so an old codebase doesn't drown a small pull request. The model's findings are filtered too: anything on a line the PR didn't touch, in a file that wasn't sent, or already found by a rule is dropped and counted. That stops it from inventing line numbers.

It ships three ways:

- **CLI:** `npx ui-guard --base origin/main`
- **GitHub Action:** one PR comment, updated in place on each push (see `examples/ui-guard.yml`, and [pull request #1](../../pull/1) for a live run on a component with seeded defects)
- **Claude Code skill:** `skill/ui-guard/SKILL.md`, so an assistant reviews its own UI changes with the same rubric before you see them. A test keeps the skill's rubric identical to the one the CLI sends.

## AI use

This repository was built with Claude Code, and the review layer calls the Claude API. Hasby directs the work and reviews it.

## Status

| Part | State |
|---|---|
| Rule checks, CLI, report, config | Done, tested |
| GitHub Action | Verified on a real pull request ([#1](../../pull/1)): posts one comment, updates it in place on the next push, fails the check on errors |
| Claude review layer | Written against the SDK, tested with a fake client; **not yet run against the live API** |
| Eval of the rule layer | Done (below) |
| Eval of the Claude layer | Not run yet (needs an API key) |

## Eval

`npm run eval` runs the rules over synthetic components in `eval/fixtures` with **28 seeded defects** (labelled in `eval/labels.json`) and two clean files.

| | Rules only |
|---|---|
| Defects caught | 20 / 28 (71%) |
| Accessibility | 9 / 14 (64%) |
| Design tokens | 6 / 8 (75%) |
| Performance | 5 / 6 (83%) |
| Precision | 100% (20 findings, 0 false) |
| False positives on clean files | 0 |

The 8 misses are mostly defects no static rule can see: colour as the only signal, a result count that screen readers never hear, a modal without dialog semantics, a title that isn't a heading, `aria-current` missing on the active link, an effect without a dependency array, a named colour (`"white"`), and an off-scale spacing value. Those are what the Claude layer is for; its numbers will be added once it has run.

**Read these numbers with care.** The fixtures and the rules were written by the same author, so recall is biased upward; one rule (arbitrary Tailwind values inside conditional `className` expressions) was widened after the first eval run showed the gap. The useful signal is the split between what rules can and can't catch, not the headline percentage.

## Rules

| Rule | Category | Severity |
|---|---|---|
| `img-alt` image without alt | a11y | error |
| `click-on-static` click handler on a div/span without role, tabIndex and key handler | a11y | error |
| `button-name` button with no text or aria-label | a11y | error |
| `input-label` input, select or textarea with no label (placeholders don't count) | a11y | error |
| `outline-none` focus outline removed with no replacement (CSS) | a11y | error |
| `anchor-button` `<a onClick>` without href | a11y | warning |
| `tabindex-positive` tabIndex above 0 | a11y | warning |
| `no-autofocus` autoFocus | a11y | warning |
| `raw-color` hex/rgb/hsl colour in inline styles or CSS outside token files | tokens | warning |
| `raw-font-size` px font size in inline styles or CSS | tokens | warning |
| `arbitrary-value` Tailwind arbitrary colour or px value | tokens | warning |
| `index-key` array index from `.map` used as key | perf | warning |
| `img-dimensions` image without width and height | perf | warning |
| `heavy-import` whole lodash or moment imported | perf | warning |

When an element spreads props (`{...props}`), rules that depend on its attributes stay quiet rather than guess.

## Configuration

Optional `ui-guard.config.json` in the repository root:

```json
{
  "tokenFiles": ["**/tokens.css", "src/theme.ts"],
  "ignore": ["**/*.stories.tsx", "legacy/**"],
  "failOn": "error",
  "disabledRules": ["no-autofocus"]
}
```

`failOn` is `error` (default), `warning` or `never`. Exit code 1 means findings at that level; 2 means UI Guard itself failed.

## Run it

Needs Node 24.

```sh
npm install
npm run build
node dist/cli.js --base origin/main        # changed lines since main
node dist/cli.js --all src/components       # whole files
```

Checks: `npm run typecheck`, `npm test`, `npm run eval`.

## Limits

- React/JSX and plain CSS only; no Vue, Svelte, CSS-in-JS template literals or Sass.
- Rules see one file at a time: a `<label htmlFor>` in another component isn't found.
- Named colours (`white`, `red`) and spacing scales aren't checked by rules.
- The Claude layer sends whole changed files (up to 60,000 characters each, 300,000 total); larger files are skipped and listed in the report, never cut off.
