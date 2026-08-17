# Style architecture

The stylesheet entry point follows a strict low-to-high specificity order:

1. `settings/` - source values and Sass maps only.
2. `themes/` - CSS custom properties emitted from settings.
3. `tools/` - mixins that do not emit CSS by themselves.
4. `generic/` - reset, document defaults, reduced motion.
5. `elements/` - native HTML element defaults.
6. `objects/` - layout-only primitives (`o-*`).
7. `components/` - reusable UI and chrome (`c-*`, header, footer).
8. `views/` - route-level composition only.

`settings/_colors.light.scss` contains the light palette. 
