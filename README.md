# Lorena’s Closet

Armario digital + generador de looks basado en reglas (sin IA externa). PWA para Android e iPhone.
Arquitectura y decisiones: [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md).

## Uso

```bash
npm install
npm run dev        # desarrollo (accesible desde el móvil en la misma wifi)
npm test           # motor de reglas + composición del collage
npm run build      # PWA lista para publicar en hosting estático (carpeta dist/)
```

Para instalarla en el móvil hay que servir `dist/` por **HTTPS** (Netlify, Vercel, GitHub Pages, Cloudflare Pages…) y usar
“Añadir a pantalla de inicio”.

## Estructura

- `src/engine/` — **motor de reglas**, TypeScript puro (sin React ni base de datos). Aquí se cambian criterios.
  - `config/defaults.ts`: tipos de prenda, afinidad entre estilos, pesos (35/25/25/15), climas, ocasiones.
  - `color.ts` (OKLCH, familias, temperatura, armonías) · `score/` (color, estilo, capas+silueta, ocasión) · `generate.ts` (beam search + diversidad).
- `src/db/` — Dexie/IndexedDB (prendas, fotos, miniaturas, looks, categorías, ajustes) y copia de seguridad ZIP.
- `src/catalog/` — categorías semilla, colores con nombre, etiquetas, prendas de ejemplo.
- `src/screens/`, `src/ui/` — interfaz.

## Privacidad

Todo ocurre en el dispositivo. El recorte de fondo usa un modelo local (`@imgly/background-removal`): la foto no sale del móvil;
solo se descarga el modelo la primera vez (~40-80 MB) y se cachea.
