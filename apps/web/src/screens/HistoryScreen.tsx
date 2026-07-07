import { useEffect, useState } from 'react'
import type { OpenFoldDB } from '../storage/db'
import { sessionDetail, sessionList, type SessionListItem } from '../storage/queries'
import type { AttemptRecord, SessionConfig } from '../telemetry/types'
import type { ReviewRequest } from './ReviewScreen'

export interface HistoryScreenProps {
  readonly db: OpenFoldDB
  readonly profileId: string
  readonly pageSize?: number
  readonly onReview: (request: ReviewRequest) => void
}

const OUTCOME_LABEL: Record<NonNullable<SessionListItem['outcome']>, string> = {
  completed: 'Completed',
  aborted: 'Aborted',
  failed: 'Failed',
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString()
}

export function HistoryScreen({ db, profileId, pageSize = 10, onReview }: HistoryScreenProps): JSX.Element {
  const [offset, setOffset] = useState(0)
  const [sessions, setSessions] = useState<readonly SessionListItem[] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedAttempts, setExpandedAttempts] = useState<readonly AttemptRecord[] | null>(null)
  const [expandedConfig, setExpandedConfig] = useState<SessionConfig | null>(null)

  useEffect(() => {
    let cancelled = false
    void sessionList(db, profileId, { limit: pageSize, offset }).then((list) => {
      if (!cancelled) setSessions(list)
    })
    return () => {
      cancelled = true
    }
  }, [db, profileId, pageSize, offset])

  function toggleExpand(session: SessionListItem): void {
    if (expandedId === session.id) {
      setExpandedId(null)
      setExpandedAttempts(null)
      setExpandedConfig(null)
      return
    }
    setExpandedId(session.id)
    setExpandedAttempts(null)
    void sessionDetail(db, session.id).then((detail) => {
      if (!detail) return
      setExpandedAttempts(detail.attempts)
      setExpandedConfig(detail.session.config)
    })
  }

  if (!sessions) return <p>Loading...</p>

  if (sessions.length === 0 && offset === 0) {
    return <p>No sessions yet -- play a round to build your history.</p>
  }

  return (
    <div>
      <ul aria-label="Session history">
        {sessions.map((session) => (
          <li key={session.id}>
            <button type="button" onClick={() => toggleExpand(session)}>
              {formatDate(session.startedAt)} -- {session.difficulty} -- {session.problemCount} problems --{' '}
              {session.accuracy === null ? 'n/a' : `${Math.round(session.accuracy * 100)}%`} --{' '}
              <span data-testid="outcome-badge">{OUTCOME_LABEL[session.outcome ?? 'aborted']}</span>
            </button>
            {expandedId === session.id && (
              <div>
                {expandedAttempts === null ? (
                  <p>Loading attempts...</p>
                ) : (
                  <ul aria-label={`Attempts for session ${session.id}`}>
                    {expandedAttempts.map((attempt) => (
                      <li key={attempt.itemIndex}>
                        Item {attempt.itemIndex + 1}: {attempt.timedOut ? 'Timeout' : attempt.correct ? 'Correct' : 'Incorrect'} ({attempt.responseMs} ms)
                        <button
                          type="button"
                          onClick={() =>
                            expandedConfig &&
                            onReview({ seed: attempt.seed, config: expandedConfig, mode: attempt.mode, chosenIndex: attempt.chosenIndex })
                          }
                        >
                          Review
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>
        Previous
      </button>
      <button type="button" disabled={sessions.length < pageSize} onClick={() => setOffset(offset + pageSize)}>
        Next
      </button>
    </div>
  )
}
