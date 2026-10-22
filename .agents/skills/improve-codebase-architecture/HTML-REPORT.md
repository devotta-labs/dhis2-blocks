# HTML Report Format

Render one self-contained HTML file outside the repository. Use inline CSS and SVG, with no external scripts, fonts or stylesheets. It must remain readable offline. Escape repository content before placing it in HTML.

## Structure

- **Header**: repository name, date, inspected scope and a compact diagram legend. Solid box = module; dashed line = seam; red arrow = leakage; thick dark box = deep module.
- **Candidates**: one card per evidence-backed opportunity, with the strongest first.
- **Top recommendation**: candidate name, one sentence explaining why, and an anchor link to its card.

Do not pad the report with speculative candidates or an introductory essay.

## Candidate card

Each candidate is an `<article>` with a stable anchor:

- **Title**: short and names the deepening, such as "Collapse the intake pipeline".
- **Recommendation badge**: `Strong` (emerald), `Worth exploring` (amber) or `Speculative` (slate).
- **Files**: monospaced paths and relevant line ranges.
- **Before / After diagram**: the centerpiece, side by side on wide screens and stacked on narrow screens.
- **Problem**: one sentence about observed friction. Include a concrete call path, duplicated protocol or testing limitation.
- **Solution**: one sentence explaining what changes, without designing a detailed interface yet.
- **Wins**: short bullets about locality, leverage and tests. For example, "Tests hit one interface" or "Fix once across both callers".
- **Constraints / uncertainty**: only when relevant; distinguish unverified assumptions from observed behavior.

Keep prose sparse. If a diagram needs a paragraph to be understood, simplify it.

## Diagram patterns

Pick the pattern that fits each candidate rather than using one template everywhere:

- **Boxes and arrows**: show modules and their call/dependency relationships using bordered divs and inline SVG paths. Label the seam and distinguish existing from proposed modules.
- **Cross-section**: before, several thin bands a call passes through; after, one consolidated module owning the behavior.
- **Interface vs implementation**: before, a large interface exposing most of the implementation's complexity; after, a smaller interface hiding that complexity. This is conceptual, not a line-count measurement.
- **Call-graph collapse**: before, a tree of calls that callers must coordinate; after, the same calls internal to one module, faded inside it.
- **Sequence**: before, ordering constraints spread across callers; after, one module owns the protocol behind its interface.

Use real names from the inspected code. Do not imply that a proposed refactor has already happened. Provide text labels so the meaning does not depend on color or SVG alone.

## Style

- Editorial rather than dashboard-like, with generous whitespace and a system font stack.
- A neutral background, one accent color, red for leakage and amber for uncertainty.
- Responsive diagrams around 320px tall when practical; allow enough room for labels without clipping.
- No runtime dependencies, network requests or app code. Avoid animations that obscure structural comparisons.

## Tone

Plain English, concise and concrete. Use module, interface, implementation, depth, seam, adapter, leverage and locality where they help explain the finding. Avoid invented terminology and generic "clean architecture" claims.

Adapted from Matt Pocock's [HTML report guide](https://github.com/mattpocock/skills/blob/5beb35b040e3de97e54fa9e386d7e42d15c295c2/skills/engineering/improve-codebase-architecture/HTML-REPORT.md), under the [MIT license](LICENSE).
