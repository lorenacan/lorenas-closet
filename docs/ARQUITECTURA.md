# Armario Digital: arquitectura funcional y técnica (propuesta v1)

> Proyecto independiente de los informes de Revenía. Vive en `armario-digital/`.
> Estado: **propuesta para aprobar antes de programar.**

---

## 0. Decisiones clave (necesito tu OK)

| # | Decisión | Propuesta | Alternativa |
|---|----------|-----------|-------------|
| D1 | Plataforma | **PWA** (web instalable en pantalla de inicio). Un solo código para Android e iPhone, sin tiendas de apps. | App nativa con Expo/React Native: mejor integración con cámara y almacenamiento, pero requiere cuentas de desarrollador (Apple 99 $/año) y más trabajo de publicación. |
| D2 | Almacenamiento | **Todo local en el móvil** (IndexedDB). Sin servidor, sin cuenta, sin que tus fotos salgan del dispositivo. | Backend propio en la nube (sincronización entre dispositivos). Se puede añadir en v2. |
| D3 | Recorte de fondo de las fotos | Librería **en el propio navegador** (modelo ONNX/WASM, tipo `@imgly/background-removal`). No envía nada fuera. Coste: descarga única de ~40-80 MB y 2-6 s por foto en móviles medios. Con opción de **omitir el recorte** y de repetirlo después. | Recorte manual (pincel), o sin recorte (fotos rectangulares en el collage). |
| D4 | Stack | TypeScript + React + Vite, Dexie (IndexedDB), Vitest. Motor de reglas como paquete TS puro sin dependencias de UI. | — |

Limitación importante de D1/D2 en iPhone: Safari puede borrar datos de webs que no se usan en semanas. Mitigación: instalar en pantalla de inicio, pedir almacenamiento persistente (`navigator.storage.persist()`) y ofrecer **exportar/importar copia de seguridad** (ZIP con JSON + fotos) desde la v1.

---

## 1. Estructura del repositorio

> **Actualización de implementación:** se simplificó a un único proyecto Vite; el motor vive en `src/engine/` (sin dependencias de UI) en lugar de un paquete aparte. Identidad visual: minimalista blanco y negro, logo en Fredoka bold, títulos Montserrat bold y texto Montserrat light.

Esquema original propuesto:

```
armario-digital/
  docs/ARQUITECTURA.md
  packages/
    engine/        # motor de reglas (TS puro, sin React ni DOM)
      src/color/   # conversión, familias, armonías
      src/rules/   # reglas de capas, estilo, silueta, ocasión
      src/score/   # ponderaciones y agregación
      src/generate/# generación de candidatos, diversidad
      config/      # pesos, matrices de afinidad, catálogos (JSON)
      test/
    app/           # PWA: pantallas, componentes, almacenamiento
      src/db/      # esquema Dexie, repositorios
      src/ui/
```

El motor recibe `Garment[]` + `GenerationRequest` y devuelve `Look[]` con puntuación y desglose. No sabe nada de pantallas ni de la base de datos. Toda la configuración (pesos, matrices, catálogos) está en JSON editable.

---

## 2. Estructura de datos

Principio: **ficha única por prenda** con categoría principal y atributos que se pueden dejar vacíos. Los catálogos (categorías, colores, estilos, etc.) son datos, no código.

```ts
Garment {
  id: string                // uuid
  name?: string
  photoId?: string          // referencia a Photo
  categoryId: string        // nodo hoja del árbol de categorías
  // color
  colorId?: string          // color del catálogo (principal)
  secondaryColorIds: string[]
  // atributos derivados del color principal (editable manualmente)
  warmth?: 'warm'|'cool'|'neutral'
  intensity?: 'muted'|'medium'|'vivid'
  lightness?: 'light'|'medium'|'dark'
  pattern?: string          // solid, stripes, checks, floral, graphic, animal...
  styles: { styleId: string, affinity: 0..1 }[]   // p. ej. blazer: classic 1, smartCasual .8
  fit?: string              // oversize, regular, slim, cropped, straight, wide, fitted
  length?: 'cropped'|'hip'|'mid-thigh'|'knee'|'long'  // sobre todo para capas
  fabric?: string
  warmthLevel?: 0..4        // grosor/abrigo
  formality?: 0..4          // 0 deportivo ... 4 formal
  seasons: ('spring'|'summer'|'autumn'|'winter')[]
  status: 'closet'|'laundry'|'dirty'|'stored'|...   // solo 'closet' es utilizable
  favorite: boolean
  notes?: string
  // capas (se rellenan por defecto desde la categoría, editables)
  layerRole?: LayerProfile  // ver sección 5
  createdAt, updatedAt
  // v2: wearCount, lastWornAt (ya reservados en el esquema)
}

Category { id, parentId|null, name, kind: 'top'|'bottom'|'onepiece'|'shoes'|'accessory',
           defaults: { layerProfile?, formality?, warmthLevel?, length?, ... }, order }

ColorSwatch { id, name, hex, family, warmth, lightness, saturation, contrastLevel }
Style      { id, name }
Photo      { id, blobOriginal, blobCutout?, thumb, width, height }
Look       { id, garmentIds: string[], layers: {top: string[]...}, score, breakdown,
             params: GenerationRequest, status: 'saved'|'favorite'|'discarded', createdAt, signature }
Collection { id, name, lookIds[] }
Settings   { weights, thresholds, ... }
```

Los atributos de color (`warmth`, `lightness`, etc.) se **calculan al elegir el color** a partir de su valor OKLCH y se pueden sobreescribir. Así registrar una prenda es: foto + categoría + color, y el resto es opcional.

Almacenamiento: IndexedDB con tablas `garments`, `photos`, `looks`, `collections`, `catalogs`, `settings`. Índices por categoría, estado y favorito. Las fotos van aparte en `photos` (blobs) con miniatura de ~400 px para la galería, de modo que miles de prendas no ralentizan las listas. El esquema usa versiones de Dexie para migrar sin perder datos.

---

## 3. Jerarquía de categorías (semilla inicial, editable)

```
Parte superior (top)
  Top · Camiseta · Camisa · Blusa · Polo · Jersey · Sudadera · Cárdigan
  Chaleco · Chaqueta · Blazer · Cazadora · Chaquetón · Abrigo
Parte inferior (bottom)
  Pantalón → Vaquero | De vestir | Chino | Cargo | Deportivo | Otros
  Pantalón corto → Vaquero | De vestir | Deportivo | Otros
  Falda → Mini | Midi | Larga
Vestidos y monos (onepiece)
  Vestido → Corto | Midi | Largo      Mono → Corto | Largo
Calzado
  Zapatillas deportivas · Zapatillas casuales · Zapatos · Botas y botines · Sandalias
Accesorios
  Bolsos · Cinturones · Gorros y gorras · Bufandas y pañuelos · Joyas · Otros
```

Es un árbol con `parentId` y profundidad ilimitada, y el usuario puede añadir, renombrar o mover nodos. Cada categoría trae **valores por defecto** (rol de capa, formalidad, abrigo) que la prenda hereda y puede sobrescribir. "Una prenda, varias características" se resuelve con atributos (estilo, corte, tejido) en vez de duplicar fichas.

---

## 4. Color

Cada color del catálogo tiene hex y se convierte a **OKLCH** (luminosidad perceptual, croma, tono). De ahí salen:

- **Familia cromática**: por tono (rojo, naranja, amarillo, verde, azul, violeta, rosa...) y "neutros" (croma bajo: negro, blanco, gris, beige, camel, marrón, marino).
- **Temperatura**: por tono (cálidos ≈ rojo-amarillo, fríos ≈ verde azulado-violeta); neutros con matiz (beige = cálido, gris azulado = frío).
- **Luminosidad** y **saturación** en tres tramos.
- **Contraste** entre dos colores = diferencia de luminosidad OKLCH.

Catálogo inicial de ~80 colores con nombre ("azul marino", "azul petróleo", "camel", "marrón chocolate", "marrón grisáceo"...), ampliable. El selector muestra paleta visual y también un selector libre que se asigna al color más cercano o crea uno nuevo.

---

## 5. Lógica de capas

Cada prenda de la parte superior tiene un **perfil de capa**:

```
LayerProfile { minLayer: 1..4, maxLayer: 1..4, canBeOpen: boolean,
               volume: 0..3, length, warmthLevel }
```

Ejemplos por defecto:

| Prenda | Capas posibles | Notas |
|---|---|---|
| Top, camiseta, blusa | 1 (base) | Contra la piel |
| Camisa | 1 base, 2 media (abierta) | `canBeOpen` |
| Polo, jersey fino | 1-2 | |
| Jersey grueso, sudadera | 2 | volumen alto |
| Cárdigan, chaleco | 2 | |
| Blazer, chaqueta | 2-3 | |
| Cazadora | 3 | |
| Chaquetón, abrigo | 4 (exterior máxima) | siempre la última |

**Algoritmo de apilado** para N capas pedidas:

1. Generar secuencias de N prendas con rangos crecientes (cada prenda debe encajar en una posición ≥ la anterior; sin repetir categoría salvo permitida).
2. Reglas duras (descartan): una prenda exterior no va debajo de una base; no dos prendas de volumen alto seguidas en capas contiguas; la prenda de capa k+1 debe tener `volume` ≥ el de la k − 1 y largo compatible (no una chaqueta cropped bajo una camiseta larga si queda feo; se evalúa como regla blanda salvo imposibilidad física).
3. Reglas blandas (puntúan): escalonado de largos, progresión de abrigo coherente con la temperatura, camisa abierta con base de contraste.
4. Los vestidos y monos ocupan base + parte inferior; el motor admite capas superiores encima.
5. Las capas de la parte superior son independientes del calzado y los accesorios.

---

## 6. Motor: reglas y puntuación

Un look se compone de `tops[N] + bottom (o vestido) + shoes + accesorios opcionales`. Cada módulo devuelve una nota 0-1 y una explicación textual ("azul + camel: complementarios suaves, neutro compartido").

### 6.1 Reglas duras (filtro previo)
Prenda no disponible, prenda excluida, color evitado, imposibilidad de capas, prenda obligatoria ausente, estación incompatible (p. ej. abrigo grueso con calor extremo).

### 6.2 Módulos de puntuación (pesos por defecto, editables)

| Módulo | Peso | Qué mide |
|---|---|---|
| Color | 35 % | Armonía, equilibrio, proporción |
| Estilo | 25 % | Afinidad entre prendas |
| Capas y silueta | 25 % | Compatibilidad física + proporciones |
| Ocasión/temporada | 15 % | Formalidad, abrigo, estación |

**Color.** Para cada par de colores dominantes se calcula la diferencia de tono y se asigna un esquema: monocromático, análogo, complementario, complementario dividido, triádico. Cada esquema tiene una puntuación base *no absoluta* que se modula con:
- **Neutros**: neutro + un color protagonista puntúa alto; muchos neutros, también.
- **Proporción**: se pondera cada color por su "área visual" estimada (parte superior exterior y pantalón pesan más; zapatos y accesorios menos). Dos colores intensos con áreas similares compiten (penaliza); uno dominante y un acento (60/30/10) premia.
- **Intensidad**: máx. 1-2 colores vivos.
- **Temperatura**: mezcla cálido/frío equilibrada o claramente dominante.
- **Contraste**: contraste de luminosidad entre partes superior e inferior moderado/alto premia salvo en modo minimalista.
- **Estampados**: un estampado grande puntúa bien; dos estampados compiten salvo misma familia/escala; el estampado con colores adyacentes hereda sus colores secundarios.
- Los colores complementarios intensos de igual área reciben penalización; los análogos apagados no se premian en exceso (evita looks aburridos si el usuario pidió "arriesgado").

**Estilo.** Matriz de afinidad `estilo × estilo` en JSON (por ejemplo casual–streetwear 0.8, formal–deportivo 0.1, smart casual–casual 0.9). La nota del look es la media de afinidad entre pares ponderada por la afinidad de cada prenda con los estilos pedidos, con un **suelo de tolerancia** para mezclas intencionadas (camiseta + blazer + zapatillas = smart casual, no se penaliza). Si el usuario elige estilos, cada prenda se puntúa contra ellos.

**Capas y silueta.** Física (sección 5) más equilibrio de volumen: ancho/estrecho arriba frente a abajo (oversize + recto o slim = alto; slim + ancho = alto; oversize + ancho = medio, salvo streetwear), longitud de la capa exterior frente al largo del bottom, y cropped con tiro alto.

**Ocasión y temporada.** Distancia entre la formalidad del look (media ponderada) y la pedida, y coherencia del abrigo total con la temperatura/estación elegida. El filtro meteorológico real queda para v2; en v1 se elige estación o temperatura manual.

### 6.3 Modos
- **Sencillo / arriesgado**: ajusta la tolerancia al contraste, a los estampados y a las mezclas de estilo, no los pesos base.
- **Priorizar poco usadas**: bonificación pequeña por prendas con menos usos (en v1 solo si hay datos; se registra cuando se guarda un look).
- **Colores preferidos/evitados**, **obligatorias/excluidas**: bonus y filtros duros.

La puntuación final (0-100) se muestra con el desglose y la razón principal. Los pesos se editan en Ajustes y se guardan.

---

## 7. Generación de looks

Enumerar todas las combinaciones no escala (miles de prendas). Estrategia:

1. **Filtrado duro** del pool por disponibilidad, exclusiones, colores evitados, estación y formalidad.
2. **Generación por construcción** en este orden: ancla (obligatoria o aleatoria ponderada por la probabilidad) → resto de capas compatibles → bottom (o vestido) → calzado → accesorios. En cada paso se queda con las mejores *K* opciones (**beam search**, K≈8-12) puntuando los módulos parciales; esto evita explorar combinaciones obviamente malas.
3. Se generan unos 200-400 candidatos completos, se puntúan por completo y se ordenan.
4. **Selección con diversidad**: se eligen los N mejores (p. ej. 8) con una variante de MMR: cada nuevo look se penaliza por solapamiento con los ya elegidos.
5. Un **generador pseudoaleatorio con semilla** da variedad entre ejecuciones ("Regenerar" cambia la semilla) sin perder el orden por calidad.

Rendimiento objetivo: <1 s en un móvil medio con 500-2000 prendas (el motor corre en un Web Worker para no bloquear la interfaz).

---

## 8. Evitar repeticiones

- Cada look tiene una **firma** = hash del conjunto ordenado de ids de prendas.
- Se guarda en memoria la lista de firmas mostradas en la sesión y se persiste el conjunto de firmas guardadas/descartadas: **un look descartado no vuelve a aparecer**.
- Cuota de reutilización: en un lote, una misma prenda aparece como máximo 2-3 veces (configurable).
- Similitud mínima: se rechaza un look que comparta más del 70 % de prendas con otro ya mostrado en el lote (MMR).
- "Regenerar" excluye lo ya visto y cambia la semilla.

---

## 9. Pantallas y navegación

Barra inferior con 4 pestañas y un botón central:

1. **Armario**: galería de rejilla con fotos, buscador, filtros (categoría, color, estilo, estación, estado, favoritos), vista por categoría.
2. **Generar** (central): selector de capas (1-4), estilos (chips), filtros opcionales en un panel plegable, botón "Crear looks".
   - **Resultados**: tarjetas con collage de cada look y puntuación; deslizar para guardar/descartar; tocar para abrir.
   - **Detalle del look**: collage grande, prendas por capas, desglose de puntuación, acciones (favorito, guardar, descartar, "cambiar esta prenda" en v1.1).
3. **Looks**: guardados y favoritos, colecciones.
4. **Ajustes**: pesos del motor, catálogos (categorías, colores, estilos), copia de seguridad.

Otras pantallas: **Añadir prenda** (cámara/galería → recorte → categoría + color → listo; resto opcional en acordeón) y **Ficha de prenda** (ver/editar/eliminar).

Diseño: la ropa es la protagonista; fondo neutro, fotos grandes, mínimos formularios. (Aquí **no** aplica la identidad de Revenía, que es solo para informes de clientes; elegiremos una paleta propia contigo.)

### Visualización del collage
Composición en canvas/SVG con plantillas por número de capas: tops a la izquierda/arriba escalonados, bottom en el centro, calzado abajo, accesorios en los laterales. Las prendas con recorte se dibujan sobre fondo neutro con sombra suave y se respeta la proporción real (escala relativa por categoría). Exportable como imagen para compartir.

---

## 10. Fases de desarrollo

| Fase | Contenido | Resultado verificable |
|---|---|---|
| **0** | Aprobar este documento, decidir D1-D4, nombre/paleta | — |
| **1** | Proyecto base, esquema de datos, catálogos semilla, PWA instalable | Se instala en el móvil |
| **2** | Alta/edición/eliminación de prendas con foto, galería y filtros | Registrar ropa real |
| **3** | Motor: color, capas, estilo, silueta, ocasión + tests unitarios con casos conocidos | `npm test` con looks esperados |
| **4** | Pantalla Generar + resultados + collage + detalle | Looks con tus prendas |
| **5** | Guardar/favoritos/descartar, anti-repetición, ajustes de pesos, backup | v1 completa |
| v2 | Historial de uso, estadísticas, meteorología, sincronización, "cambiar prenda" | — |

El motor se prueba con tests que codifican criterios de estilismo ("azul marino + beige + blanco puntúa más que rojo intenso + naranja intenso + rosa intenso") para ir afinando con ejemplos reales.

---

## 11. Limitaciones de la v1

- Datos solo en el dispositivo (sin sincronización entre móvil y tablet); copia de seguridad manual.
- Sin meteorología ni historial/estadísticas de uso.
- Recorte automático de fondo: calidad variable con ropa blanca sobre fondo blanco, o prendas con transparencias; se podrá omitir o retocar.
- El motor evalúa atributos registrados, no analiza la foto: la calidad de los looks depende de lo bien etiquetadas que estén las prendas (por eso color, categoría y estilo son prioritarios).
- Estilismo subjetivo: las reglas son un punto de partida; los pesos y matrices se ajustarán con el uso.
- Sin avatar ni prueba virtual (como pediste).
- Safari/iOS: límites de almacenamiento y sin notificaciones push avanzadas.
