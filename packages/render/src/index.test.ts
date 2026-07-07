import { describe, expect, it } from 'vitest'
import { RENDER_PACKAGE_NAME } from './index'

describe('package scaffold', () => {
  it('exports a placeholder', () => {
    expect(RENDER_PACKAGE_NAME).toBe('@openfold/render')
  })
})
