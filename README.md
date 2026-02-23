# PANE: _Pixel Art Notation Engine_

Playground for PANL, the deterministic isometric pixel-art notation language in JSON form.

## PANL Docs
- Human-readable docs/spec: `/docs`
- Machine-readable spec JSON: `/docs/panl.json`
- Markdown export: `/docs/panl.md`
- Alias JSON endpoint: `/docs.json`

The app is static (`adapter-static`), so these endpoints are emitted at build time and can be:
- Served under the same domain as the playground by deploying all of `build/`.
- Deployed to a docs-only subdomain by publishing at least `build/docs/`, `build/docs.json`, and `build/_app/`.

## Stack
- Bun (package manager + scripts)
- SvelteKit + TypeScript
- Canvas software rasterizer
- Ajv (JSON Schema validation)
- CodeMirror 6 (lazy-loaded editor)

## Commands
```sh
# install
bun install

# dev server
bun run dev

# type + svelte checks
bun run check

# production static build (output in ./build)
bun run build

# preview built site
bun run preview
```
