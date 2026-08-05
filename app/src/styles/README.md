# Style architecture

The stylesheet entry point follows a strict low-to-high specificity order:

1. `settings/` — source values and Sass maps only.
2. `themes/` — CSS custom properties emitted from settings.
3. `tools/` — mixins that do not emit CSS by themselves.
4. `generic/` — reset, document defaults, reduced motion.
5. `elements/` — native HTML element defaults.
6. `objects/` — layout-only primitives (`o-*`).
7. `components/` — reusable UI and chrome (`c-*`, header, footer).
8. `views/` — route-level composition only.

`settings/_colors.light.scss` contains the light palette and is the future theme boundary. The
spacing, type, radius, and stroke maps reproduce values present in the supplied guideline cards.

The guideline cards contain no shadow values, so `_shadows.scss` intentionally defines only
`none`. Liquid-glass blur, saturation, motion, and page geometry are isolated implementation
settings rather than documented brand tokens.
