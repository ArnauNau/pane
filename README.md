# PANE: _Pixel Art Notation Engine_

Playground for PANL, the deterministic isometric pixel-art notation language in JSON form.

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

