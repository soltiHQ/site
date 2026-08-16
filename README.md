# Solti site

The repository is split into two project surfaces:

- `app/` - the Vue 3, TypeScript, Vue Router, and SCSS application.
- `tf/` - infrastructure configuration; intentionally unchanged at this stage.

## Application

```sh
cd app
npm install
npm run dev
```

`npm run build` runs the TypeScript/Vue check and creates the static build in `app/dist/`.

The current route renders an empty `ContentView` inside the shared header/footer layout. Reusable
typography, action, form, surface, table, layout, and View primitives are implemented under
`app/src/components/`, but product content is intentionally deferred.
