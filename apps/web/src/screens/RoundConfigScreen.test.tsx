import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SessionConfig } from '../telemetry/types'
import { RoundConfigScreen } from './RoundConfigScreen'

describe('RoundConfigScreen', () => {
  it('defaults to medium / 10 problems / 30s / fold when there is no prior config', () => {
    render(<RoundConfigScreen onStart={() => {}} />)
    expect(screen.getByLabelText('Difficulty')).toHaveValue('medium')
    expect(screen.getByLabelText('Problem count')).toHaveValue(10)
    expect(screen.getByLabelText('Time limit (seconds)')).toHaveValue(30)
    expect(screen.getByLabelText('Mode')).toHaveValue('fold')
  })

  it('pre-fills from initialConfig when provided', () => {
    render(<RoundConfigScreen initialConfig={{ difficulty: 'hard', problemCount: 20, timeLimitMs: 60_000, mode: 'unfold' }} onStart={() => {}} />)
    expect(screen.getByLabelText('Difficulty')).toHaveValue('hard')
    expect(screen.getByLabelText('Problem count')).toHaveValue(20)
    expect(screen.getByLabelText('Time limit (seconds)')).toHaveValue(60)
    expect(screen.getByLabelText('Mode')).toHaveValue('unfold')
  })

  it('an out-of-range problem count disables Start and shows an inline message', () => {
    render(<RoundConfigScreen onStart={() => {}} />)
    fireEvent.change(screen.getByLabelText('Problem count'), { target: { value: '3' } })
    expect(screen.getByRole('button', { name: 'Start round' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/problemCount/)
  })

  it('an out-of-range time limit disables Start and shows an inline message', () => {
    render(<RoundConfigScreen onStart={() => {}} />)
    fireEvent.change(screen.getByLabelText('Time limit (seconds)'), { target: { value: '5' } })
    expect(screen.getByRole('button', { name: 'Start round' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent(/timeLimitMs/)
  })

  it('checking Unlimited time removes the time-limit field and validates without it', () => {
    render(<RoundConfigScreen onStart={() => {}} />)
    fireEvent.click(screen.getByLabelText('Unlimited time'))
    expect(screen.queryByLabelText('Time limit (seconds)')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start round' })).not.toBeDisabled()
  })

  it('submitting a valid config calls onStart with the exact config plus a generated seed', () => {
    const onStart = vi.fn<(config: SessionConfig) => void>()
    render(<RoundConfigScreen onStart={onStart} generateSeed={() => 42} />)
    fireEvent.change(screen.getByLabelText('Problem count'), { target: { value: '15' } })
    fireEvent.change(screen.getByLabelText('Difficulty'), { target: { value: 'hard' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start round' }))
    expect(onStart).toHaveBeenCalledWith({
      difficulty: 'hard',
      problemCount: 15,
      timeLimitMs: 30_000,
      mode: 'fold',
      sessionSeed: 42,
    })
  })

  it('does not call onStart when the config is invalid', () => {
    const onStart = vi.fn()
    render(<RoundConfigScreen onStart={onStart} />)
    fireEvent.change(screen.getByLabelText('Problem count'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start round' }))
    expect(onStart).not.toHaveBeenCalled()
  })
})
