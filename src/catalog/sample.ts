import { db, uid, type GarmentRecord } from '../db/db'
import { ALL_SWATCHES } from './colors'

const hex = (name: string) => ALL_SWATCHES.find((s) => s.name === name)?.hex

const ROWS: [string, string, string, Partial<GarmentRecord>?][] = [
  ['camiseta', 'Camiseta blanca', 'Blanco'], ['camiseta', 'Camiseta negra', 'Negro'], ['camiseta', 'Camiseta naranja', 'Naranja quemado'],
  ['camiseta', 'Camiseta rayas marino', 'Azul marino', { pattern: 'stripes', secondaryHex: [hex('Blanco')!] }],
  ['top', 'Top negro', 'Negro'], ['camisa', 'Camisa azul claro', 'Denim claro'], ['camisa', 'Camisa blanca', 'Blanco'],
  ['blusa', 'Blusa crema', 'Crema'], ['polo', 'Polo verde botella', 'Verde botella'],
  ['jersey', 'Jersey marino', 'Azul marino'], ['jersey', 'Jersey camel', 'Camel'], ['sudadera', 'Sudadera gris', 'Gris'],
  ['cardigan', 'Cárdigan crema', 'Crema'], ['chaleco', 'Chaleco gris marengo', 'Gris marengo'],
  ['blazer', 'Blazer marino', 'Azul marino'], ['blazer', 'Blazer negro', 'Negro'], ['cazadora', 'Cazadora denim', 'Denim'],
  ['chaqueta', 'Chaqueta beige', 'Beige'], ['abrigo', 'Abrigo camel', 'Camel'], ['chaqueton', 'Chaquetón negro', 'Antracita'],
  ['pantalon-vaquero', 'Vaqueros azules', 'Denim'], ['pantalon-vaquero', 'Vaqueros negros', 'Negro'],
  ['pantalon-vestir', 'Pantalón de vestir negro', 'Negro'], ['pantalon-chino', 'Chinos beige', 'Beige'],
  ['pantalon-cargo', 'Cargo verde', 'Verde militar'], ['pantalon-deportivo', 'Jogger gris', 'Gris marengo'],
  ['falda-midi', 'Falda midi negra', 'Negro'], ['falda-mini', 'Mini vaquera', 'Denim claro'], ['corto-vaquero', 'Short vaquero', 'Denim'],
  ['vestido-midi', 'Vestido midi negro', 'Negro'], ['mono-largo', 'Mono verde oliva', 'Verde oliva'],
  ['zapatilla_casual', 'Zapatillas blancas', 'Blanco'], ['zapatilla_deportiva', 'Deportivas negras', 'Negro'],
  ['zapato', 'Mocasines marrones', 'Marrón chocolate'], ['bota', 'Botines negros', 'Negro'], ['sandalia', 'Sandalias camel', 'Camel'],
  ['bolso', 'Bolso negro', 'Negro'], ['bolso', 'Bolso camel', 'Camel'], ['cinturon', 'Cinturón marrón', 'Marrón chocolate'],
  ['bufanda', 'Bufanda granate', 'Granate'], ['gorro', 'Gorra marino', 'Azul marino'], ['joya', 'Collar dorado', 'Dorado'],
]

/** Prendas de ejemplo sin foto, para probar el generador enseguida. */
export async function loadSampleWardrobe(): Promise<number> {
  const now = Date.now()
  const recs: GarmentRecord[] = ROWS.map(([categoryId, name, color, extra], i) => ({
    id: uid(), name, categoryId, colorHex: hex(color), colorName: color, secondaryHex: [], styles: {}, seasons: [],
    status: 'closet', favorite: false, wearCount: 0, createdAt: now + i, updatedAt: now + i, ...extra,
  }))
  await db.garments.bulkPut(recs)
  return recs.length
}
