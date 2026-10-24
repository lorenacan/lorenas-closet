import { generateLooks } from '../engine'

self.onmessage = (e: MessageEvent) => {
  const { id, garments, req } = e.data
  self.postMessage({ id, result: generateLooks(garments, req) })
}
