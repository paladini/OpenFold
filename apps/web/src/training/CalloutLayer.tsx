import type { ProblemScene } from '@openfold/render'
import type { AnchorKey, AnchorPos } from '@openfold/render'
import { useEffect, useState } from 'react'

export interface ResolvedCallout {
  readonly anchor: AnchorKey
  readonly text: string
}

export interface CalloutLayerProps {
  readonly scene: ProblemScene | null
  readonly callouts: readonly ResolvedCallout[]
}

/** Quadrant-based arrow direction, based on where the anchor sits relative to the viewport center. */
function arrowFor(pos: AnchorPos): 'up' | 'down' | 'left' | 'right' {
  const dx = pos.x - window.innerWidth / 2
  const dy = pos.y - window.innerHeight / 2
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up'
}

/** DOM tooltip layer pinned to AnchorTracker positions -- real, screen-readable text over the canvas, not in-scene sprites. */
export function CalloutLayer({ scene, callouts }: CalloutLayerProps): JSX.Element {
  const [positions, setPositions] = useState<Partial<Record<AnchorKey, AnchorPos>>>({})

  useEffect(() => {
    const anchors = scene?.anchors
    if (!anchors) {
      setPositions({})
      return
    }
    const unsubscribes = callouts.map((c) =>
      anchors.subscribe(c.anchor, (pos) => {
        setPositions((prev) => ({ ...prev, [c.anchor]: pos }))
      }),
    )
    return () => {
      for (const unsub of unsubscribes) unsub()
    }
    // callouts is compared by the anchors it declares; a new callout list re-subscribes.
  }, [scene, callouts])

  return (
    <div aria-label="Callouts" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {callouts.map((c) => {
        const pos = positions[c.anchor]
        if (!pos || !pos.visible) return null
        const arrow = arrowFor(pos)
        return (
          <div key={c.anchor} role="note" data-arrow={arrow} style={{ position: 'absolute', left: pos.x, top: pos.y }}>
            {c.text}
          </div>
        )
      })}
    </div>
  )
}
