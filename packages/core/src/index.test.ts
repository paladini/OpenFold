import { describe, expect, it } from 'vitest'
import { CORE_PACKAGE_NAME } from './index'

describe('package scaffold', () => {
  it('exports a placeholder', () => {
    expect(CORE_PACKAGE_NAME).toBe('@openfold/core')
  })
})
