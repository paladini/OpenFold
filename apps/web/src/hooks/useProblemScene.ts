import type { FoldProblem, UnfoldProblem } from '@openfold/core'
import { ProblemScene, type SceneOptions } from '@openfold/render'
import { useEffect, useRef, useState, type RefObject } from 'react'

export interface UseProblemSceneResult {
  readonly scene: ProblemScene | null
  readonly error: Error | null
}

/**
 * Owns a ProblemScene's mount/dispose lifecycle. Strict-mode-safe: React 18's development-mode
 * double-invoke of effects would otherwise mount two scenes onto the same container; this hook
 * always disposes whatever scene it previously created (ProblemScene.mount is itself idempotent
 * too, as a second line of defense) before mounting a new one.
 */
export function useProblemScene(
  containerRef: RefObject<HTMLElement | null>,
  problem: FoldProblem | UnfoldProblem | null,
  opts?: SceneOptions,
): UseProblemSceneResult {
  const sceneRef = useRef<ProblemScene | null>(null)
  const [result, setResult] = useState<UseProblemSceneResult>({ scene: null, error: null })

  useEffect(() => {
    const container = containerRef.current
    if (!container || !problem) {
      setResult({ scene: null, error: null })
      return
    }

    const scene = new ProblemScene()
    sceneRef.current = scene
    try {
      scene.mount(container, problem, opts)
      setResult({ scene, error: null })
    } catch (err) {
      setResult({ scene: null, error: err instanceof Error ? err : new Error(String(err)) })
    }

    return () => {
      scene.dispose()
      if (sceneRef.current === scene) sceneRef.current = null
    }
    // Intentionally excludes `opts` from deps: it's a plain options object, not a stable ref, and
    // re-mounting on every options identity change would defeat the point of a lifecycle hook.
    // Callers should memoize opts if it varies.
  }, [containerRef, problem])

  return result
}
