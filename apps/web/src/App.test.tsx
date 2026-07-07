import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App scaffold', () => {
  it('renders a placeholder', () => {
    render(<App />)
    expect(screen.getByText('OpenFold')).toBeInTheDocument()
  })
})
