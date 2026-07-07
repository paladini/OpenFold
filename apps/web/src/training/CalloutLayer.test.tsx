import { act, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AnchorKey, AnchorPos } from '@openfold/render'
import { CalloutLayer, type ResolvedCallout } from './CalloutLayer'

interface FakeAnchorTracker {
  subscribe: (key: AnchorKey, cb: (pos: AnchorPos) => void) => () => void
  listeners: Map<AnchorKey, Array<(pos: AnchorPos) => void>>
  emit: (key: AnchorKey, pos: AnchorPos) => void
}

function makeFakeAnchors(): FakeAnchorTracker {
  const listeners = new Map<AnchorKey, Array<(pos: AnchorPos) => void>>()
  return {
    listeners,
    subscribe(key, cb) {
      const list = listeners.get(key) ?? []
      list.push(cb)
      listeners.set(key, list)
      return () => {
        listeners.set(
          key,
          (listeners.get(key) ?? []).filter((l) => l !== cb),
        )
      }
    },
    emit(key, pos) {
      for (const cb of listeners.get(key) ?? []) cb(pos)
    },
  }
}

function fakeScene(anchors: FakeAnchorTracker | null): { anchors: unknown } {
  return { anchors }
}

describe('CalloutLayer', () => {
  it('renders a callout at the position its anchor reports', () => {
    const anchors = makeFakeAnchors()
    const callouts: ResolvedCallout[] = [{ anchor: 'face:0', text: 'Face 0' }]
    render(<CalloutLayer scene={fakeScene(anchors) as never} callouts={callouts} />)

    act(() => anchors.emit('face:0', { x: 100, y: 50, visible: true }))
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('Face 0')
    expect(note.style.left).toBe('100px')
    expect(note.style.top).toBe('50px')
  })

  it('updates position on a subsequent tick', () => {
    const anchors = makeFakeAnchors()
    const callouts: ResolvedCallout[] = [{ anchor: 'face:0', text: 'Face 0' }]
    render(<CalloutLayer scene={fakeScene(anchors) as never} callouts={callouts} />)

    act(() => anchors.emit('face:0', { x: 100, y: 50, visible: true }))
    act(() => anchors.emit('face:0', { x: 200, y: 75, visible: true }))
    const note = screen.getByRole('note')
    expect(note.style.left).toBe('200px')
    expect(note.style.top).toBe('75px')
  })

  it('hides the callout when its anchor reports visible: false', () => {
    const anchors = makeFakeAnchors()
    const callouts: ResolvedCallout[] = [{ anchor: 'face:0', text: 'Face 0' }]
    render(<CalloutLayer scene={fakeScene(anchors) as never} callouts={callouts} />)

    act(() => anchors.emit('face:0', { x: 100, y: 50, visible: true }))
    expect(screen.getByRole('note')).toBeInTheDocument()
    act(() => anchors.emit('face:0', { x: 100, y: 50, visible: false }))
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('unsubscribes every callout on unmount', () => {
    const anchors = makeFakeAnchors()
    const callouts: ResolvedCallout[] = [
      { anchor: 'face:0', text: 'A' },
      { anchor: 'face:1', text: 'B' },
    ]
    const { unmount } = render(<CalloutLayer scene={fakeScene(anchors) as never} callouts={callouts} />)

    expect(anchors.listeners.get('face:0')).toHaveLength(1)
    expect(anchors.listeners.get('face:1')).toHaveLength(1)
    unmount()
    expect(anchors.listeners.get('face:0')).toHaveLength(0)
    expect(anchors.listeners.get('face:1')).toHaveLength(0)
  })

  it('renders nothing and does not throw when the scene has no anchors yet', () => {
    render(<CalloutLayer scene={fakeScene(null) as never} callouts={[{ anchor: 'face:0', text: 'A' }]} />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('renders nothing when the scene itself is null', () => {
    render(<CalloutLayer scene={null} callouts={[{ anchor: 'face:0', text: 'A' }]} />)
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  it('tracks multiple independent callouts by their own anchor key', () => {
    const anchors = makeFakeAnchors()
    const callouts: ResolvedCallout[] = [
      { anchor: 'face:0', text: 'A' },
      { anchor: 'face:1', text: 'B' },
    ]
    render(<CalloutLayer scene={fakeScene(anchors) as never} callouts={callouts} />)
    act(() => {
      anchors.emit('face:0', { x: 1, y: 1, visible: true })
      anchors.emit('face:1', { x: 2, y: 2, visible: true })
    })
    expect(screen.getAllByRole('note')).toHaveLength(2)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
  })
})
