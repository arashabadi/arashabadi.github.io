# Design QA

## Evidence

- Source visual truth: `/Users/ashi/.codex/generated_images/019e45f4-72ae-7a63-9f6c-5dceb1876269/exec-54a30e6e-0ae9-463f-a84c-fadc440c2022.png`
- Desktop implementation: `/private/tmp/arash-home-animated-desktop-1440x1024.jpg`
- Mobile implementation: `/private/tmp/arash-home-animated-mobile-390x844.jpg`
- Assembled animation state: `/private/tmp/arash-home-assembled-1440x1024.jpg`
- Mobile menu state: `/private/tmp/arash-menu-mobile-390x844.jpg`
- Desktop viewport: 1440 x 1024 CSS px at density 1
- Mobile viewport: 390 x 844 CSS px at density 1
- Source pixels: 1487 x 1058; desktop implementation viewport: 1440 x 1024.
- State: dark-only, unfocused hero; mobile navigation, responsive hero framing, and publication cleanup were checked separately.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Typography: Newsreader and DM Sans preserve the reference hierarchy, weight contrast, zero letter spacing, and wrapping. Minor glyph-shape differences from the generated reference are acceptable P3 drift.
- Layout: the tissue uses responsive `cover` framing with a restrained scale adjustment, keeping the complete visual emphasis on the left while avoiding empty or undersized states on phones, laptops, and wide displays. The identity column, controls, and next-section hint retain the reference proportions. Both hero controls use the selected 8px radius.
- Color: charcoal black, near-white type, cyan/turquoise data, and sparse copper accents match the selected direction with sufficient contrast.
- Image quality: the project uses a dedicated 1486 x 1058 generated raster asset, not CSS or SVG stand-ins. The WebP remains sharp at the tested viewports and has no visible masking seam.
- Copy: name, alternate name, umbrella line, fields, and action labels match the selected reference.
- Icons: Bootstrap Icons supply the menu, arrows, and GitHub mark with consistent optical weight.
- Responsiveness: 390 x 844 has no horizontal overflow, clipping, overlap, or broken wrapping; both buttons remain equal-width tap targets. The mobile canvas is exactly 390 x 371 CSS px and uses fewer cells.
- Accessibility and behavior: focus remains visible, controls are labelled, Connect stays in the same tab, GitHub opens externally, and the menu is opaque after scrolling. The interface is intentionally dark-only.
- Motion: the transparent Three.js canvas remains available as the current subtle overlay and is disabled for `prefers-reduced-motion`. Further hero motion is deliberately deferred to a later focused pass.
- Publication archive: all four figures remain present; explanatory figcaptions and the two requested introductory paragraphs are absent.

## Comparison History

1. Earlier passes aligned the identity block, control order, and selected 8px button radius with the approved concept.
2. The latest pass replaced undersized framing with responsive, left-centered `cover` behavior and viewport-specific scale constraints.
3. The current pass removed the light-theme controls and code, simplified the information hierarchy, and deferred additional animation work.

## Verification

- Quarto production render completed successfully.
- Desktop, mobile, and wide-display dark heroes, mobile navigation, and the publication archive were browser-rendered.
- Layout overflow, menu open/close, Connect target, GitHub target, and dark-only behavior were checked.
- Browser console errors: none.

## Follow-up Polish

- P3: the generated source and browser-rendered Newsreader glyphs are not pixel-identical, but their hierarchy and character are equivalent.

final result: passed
