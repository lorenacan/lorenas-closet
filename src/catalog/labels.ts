import type { Climate, Fit, LengthLevel, Occasion, Pattern, Risk, Season } from '../engine'

export const PATTERNS: [Pattern, string][] = [
  ['solid', 'Liso'], ['stripes', 'Rayas'], ['checks', 'Cuadros'], ['floral', 'Floral'],
  ['graphic', 'Gráfico'], ['animal', 'Animal print'], ['dots', 'Lunares'], ['other', 'Otro'],
]
export const FITS: [Fit, string][] = [
  ['fitted', 'Entallado'], ['slim', 'Slim'], ['regular', 'Regular'], ['straight', 'Recto'], ['wide', 'Ancho'], ['oversize', 'Oversize'],
]
export const LENGTHS: [LengthLevel, string][] = [
  ['cropped', 'Cropped'], ['hip', 'Cadera'], ['mid-thigh', 'Muslo'], ['knee', 'Rodilla'], ['long', 'Largo'],
]
export const SEASONS: [Season, string][] = [['spring', 'Primavera'], ['summer', 'Verano'], ['autumn', 'Otoño'], ['winter', 'Invierno']]
export const STATUSES: [string, string][] = [
  ['closet', 'En el armario'], ['dirty', 'En la ropa sucia'], ['laundry', 'En la lavandería'],
  ['stored', 'Guardada por temporada'], ['lent', 'Prestada / fuera'],
]
export const CLIMATES: [Climate, string][] = [
  ['hot', 'Mucho calor'], ['warm', 'Calor suave'], ['mild', 'Templado'], ['cool', 'Fresco'], ['cold', 'Frío'],
]
export const OCCASIONS: [Occasion, string][] = [
  ['diario', 'Diario'], ['trabajo', 'Trabajo'], ['evento', 'Evento'], ['salir', 'Salir'], ['deporte', 'Deporte'],
]
export const RISKS: [Risk, string][] = [['simple', 'Sencillo'], ['balanced', 'Equilibrado'], ['bold', 'Atrevido']]
export const INSULATION = ['Nada', 'Fino', 'Medio', 'Grueso', 'Muy grueso']
export const FORMALITY = ['Deportivo', 'Casual', 'Smart', 'Elegante', 'Formal']
export const TEMPS: [string, string][] = [['warm', 'Cálido'], ['cool', 'Frío'], ['neutral', 'Neutro']]
export const INTENSITIES: [string, string][] = [['muted', 'Apagado'], ['medium', 'Medio'], ['vivid', 'Intenso']]
export const LIGHTNESS: [string, string][] = [['light', 'Claro'], ['medium', 'Medio'], ['dark', 'Oscuro']]

export const label = (list: [string, string][], key?: string) => list.find((x) => x[0] === key)?.[1] ?? ''
