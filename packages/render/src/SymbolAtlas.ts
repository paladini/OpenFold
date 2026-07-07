import type { Rotation } from '@openfold/core'
import { CanvasTexture } from 'three'
import { GLYPH_BY_ID, getGlyph } from './glyphs'
import type { SubPath } from './glyphPath'

export interface UvRegion {
  readonly u0: number
  readonly v0: number
  readonly u1: number
  readonly v1: number
}

const CELL_SIZE = 64
const ROTATIONS: readonly Rotation[] = [0, 90, 180, 270]

/** A cached texture atlas of every glyph pre-baked at all 4 rotations, with UV region lookup. */
export class SymbolAtlas {
  readonly texture: CanvasTexture
  private readonly regions = new Map<string, UvRegion>()

  constructor() {
    const glyphIds = [...GLYPH_BY_ID.keys()]
    const cellsNeeded = glyphIds.length * ROTATIONS.length
    const cols = Math.ceil(Math.sqrt(cellsNeeded))
    const rows = Math.ceil(cellsNeeded / cols)

    const canvas = document.createElement('canvas')
    canvas.width = cols * CELL_SIZE
    canvas.height = rows * CELL_SIZE
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | null
    if (!ctx) throw new Error('SymbolAtlas: 2D canvas context unavailable')

    let cellIndex = 0
    for (const glyphId of glyphIds) {
      const glyph = getGlyph(glyphId)
      for (const rotation of ROTATIONS) {
        const col = cellIndex % cols
        const row = Math.floor(cellIndex / cols)
        drawGlyphCell(ctx, glyph.subPaths, col, row, rotation)
        // Flip V: canvas rows grow downward, texture V grows upward.
        this.regions.set(`${glyphId}:${rotation}`, {
          u0: col / cols,
          v0: 1 - (row + 1) / rows,
          u1: (col + 1) / cols,
          v1: 1 - row / rows,
        })
        cellIndex++
      }
    }

    this.texture = new CanvasTexture(canvas)
    this.texture.needsUpdate = true
  }

  getUv(glyphId: string, rotation: Rotation): UvRegion {
    const region = this.regions.get(`${glyphId}:${rotation}`)
    if (!region) throw new Error(`SymbolAtlas: no region for glyphId "${glyphId}" rotation ${rotation}`)
    return region
  }

  dispose(): void {
    this.texture.dispose()
  }
}

function drawGlyphCell(ctx: CanvasRenderingContext2D, subPaths: readonly SubPath[], col: number, row: number, rotation: Rotation): void {
  const cx = col * CELL_SIZE + CELL_SIZE / 2
  const cy = row * CELL_SIZE + CELL_SIZE / 2
  const scale = CELL_SIZE * 0.45

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.fillStyle = '#e2e8f0'

  for (const path of subPaths) {
    if (path.length === 0) continue
    ctx.beginPath()
    const first = path[0] as { x: number; y: number }
    ctx.moveTo(first.x * scale, -first.y * scale)
    for (let i = 1; i < path.length; i++) {
      const p = path[i] as { x: number; y: number }
      ctx.lineTo(p.x * scale, -p.y * scale)
    }
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}
