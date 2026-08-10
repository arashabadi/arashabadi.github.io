# Design QA

## Evidence

- Source visual truth: `/Users/ashi/.codex/generated_images/019e45f4-72ae-7a63-9f6c-5dceb1876269/exec-c4851d78-6cb9-4857-9d15-afcb9c697ef9.png`
- Desktop implementation: `/private/tmp/arash-home-final-1440x1024-v4.png`
- Mobile implementation: `/private/tmp/arash-home-final-390x844.png`
- Full comparison: `/private/tmp/arash-home-reference-vs-implementation-v2.png`
- Focused identity/actions comparison: `/private/tmp/arash-home-focus-reference-vs-implementation.png`
- Desktop viewport: 1440 x 1024 CSS px at density 1
- Mobile viewport: 390 x 844 CSS px at density 1
- Source pixels: 1487 x 1058; implementation pixels: 1440 x 1024
- Normalization: each full view was aspect-fit and padded to 720 x 512 before side-by-side comparison.
- State: dark default, unfocused hero; light theme and scrolled navigation were checked separately.

## Findings

- No actionable P0, P1, or P2 differences remain.
- Typography: Newsreader and DM Sans preserve the reference hierarchy, weight contrast, zero letter spacing, and wrapping. Minor glyph-shape differences from the generated reference are acceptable P3 drift.
- Layout: the tissue, identity column, controls, negative space, and next-section hint match the reference proportions. Both hero controls use the selected 8px radius.
- Color: charcoal black, near-white type, cyan/turquoise data, and sparse copper accents match the selected direction with sufficient contrast.
- Image quality: the project uses a dedicated 1486 x 1058 generated raster asset, not CSS or SVG stand-ins. The contained WebP is sharp and has no visible masking seam.
- Copy: name, alternate name, umbrella line, fields, and action labels match the selected reference.
- Icons: Bootstrap Icons supply the theme, menu, arrows, and GitHub mark with consistent optical weight.
- Responsiveness: 390 x 844 has no horizontal overflow, clipping, overlap, or broken wrapping; both buttons remain equal-width tap targets.
- Accessibility and behavior: focus remains visible, controls are labelled, Connect stays in the same tab, GitHub opens externally, the menu is opaque after scrolling, and theme preference persists.

## Comparison History

1. Pass 1 found P2 crop and proportion drift: the tissue sat too far left and the controls were too narrow. Fixed by using the selected text-free girih asset full-width and matching button dimensions/radius.
2. Pass 2 found P2 identity alignment and action-order drift. Fixed by moving the identity block left/up, refining the type rhythm, and placing the GitHub icon after its label.
3. Pass 3 compared the revised full view and focused identity/action region. No P0/P1/P2 differences remained.

## Verification

- Quarto production render completed successfully.
- Desktop dark hero, mobile dark hero, mobile light hero, and scrolled light navigation were browser-rendered.
- Theme toggle, menu open/close, Connect target, and GitHub target were checked.
- Browser console errors: none.

## Follow-up Polish

- P3: the generated source and browser-rendered Newsreader glyphs are not pixel-identical, but their hierarchy and character are equivalent.

final result: passed
