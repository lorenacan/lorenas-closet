export interface Swatch { name: string; hex: string }

export const SWATCH_GROUPS: { label: string; colors: Swatch[] }[] = [
  { label: 'Neutros', colors: [
    { name: 'Blanco', hex: '#ffffff' }, { name: 'Blanco roto', hex: '#f4efe6' }, { name: 'Crema', hex: '#efe6d2' },
    { name: 'Beige', hex: '#e0d2b8' }, { name: 'Arena', hex: '#d2bf9e' }, { name: 'Camel', hex: '#c19a6b' },
    { name: 'Marrón claro', hex: '#a47551' }, { name: 'Marrón chocolate', hex: '#4a2c1a' }, { name: 'Marrón grisáceo', hex: '#6e5f55' },
    { name: 'Taupe', hex: '#8b7b6e' }, { name: 'Caqui', hex: '#8a8456' },
    { name: 'Gris claro', hex: '#d9d9d9' }, { name: 'Gris perla', hex: '#bfc3c7' }, { name: 'Gris', hex: '#8a8a8a' },
    { name: 'Gris marengo', hex: '#55585c' }, { name: 'Antracita', hex: '#33363a' }, { name: 'Negro', hex: '#111111' },
  ] },
  { label: 'Azules', colors: [
    { name: 'Azul noche', hex: '#121c33' }, { name: 'Azul marino', hex: '#1f2a44' }, { name: 'Denim', hex: '#4f6d99' },
    { name: 'Denim claro', hex: '#8fb0d6' }, { name: 'Azul cobalto', hex: '#2a5db0' }, { name: 'Azul eléctrico', hex: '#1f4eff' },
    { name: 'Azul cielo', hex: '#87ceeb' }, { name: 'Azul bebé', hex: '#b9d6f2' }, { name: 'Azul petróleo', hex: '#0f5e6e' },
    { name: 'Turquesa', hex: '#1fb5ae' }, { name: 'Aguamarina', hex: '#7fd6c9' },
  ] },
  { label: 'Verdes', colors: [
    { name: 'Verde botella', hex: '#0f3d2e' }, { name: 'Verde bosque', hex: '#1f4d2b' }, { name: 'Verde militar', hex: '#4b5320' },
    { name: 'Verde oliva', hex: '#5b6b2f' }, { name: 'Verde esmeralda', hex: '#0f8a5f' }, { name: 'Verde salvia', hex: '#9aa88a' },
    { name: 'Verde menta', hex: '#a8dcc0' }, { name: 'Verde lima', hex: '#b6d84a' },
  ] },
  { label: 'Cálidos', colors: [
    { name: 'Amarillo', hex: '#f2d024' }, { name: 'Limón', hex: '#f4ec6b' }, { name: 'Mostaza', hex: '#d4a017' },
    { name: 'Naranja', hex: '#f08a1c' }, { name: 'Naranja quemado', hex: '#c4561c' }, { name: 'Terracota', hex: '#c2603f' },
    { name: 'Coral', hex: '#f26b5b' }, { name: 'Salmón', hex: '#f4a38c' },
    { name: 'Rojo', hex: '#c8102e' }, { name: 'Rojo vivo', hex: '#e8202a' }, { name: 'Granate', hex: '#7a1f2e' }, { name: 'Burdeos', hex: '#6b1a2b' },
  ] },
  { label: 'Rosas y violetas', colors: [
    { name: 'Rosa palo', hex: '#e9c4c6' }, { name: 'Rosa chicle', hex: '#f7a8cf' }, { name: 'Rosa', hex: '#f08bb0' }, { name: 'Fucsia', hex: '#d81b84' },
    { name: 'Malva', hex: '#b88aa8' }, { name: 'Lila', hex: '#c4b1e0' }, { name: 'Lavanda', hex: '#b7a6d8' },
    { name: 'Violeta', hex: '#6a3fa0' }, { name: 'Morado', hex: '#4b2a6b' }, { name: 'Berenjena', hex: '#3d2340' },
  ] },
  { label: 'Metálicos', colors: [{ name: 'Plateado', hex: '#c0c0c0' }, { name: 'Dorado', hex: '#c9a24a' }] },
]

export const ALL_SWATCHES: Swatch[] = SWATCH_GROUPS.flatMap((g) => g.colors)
