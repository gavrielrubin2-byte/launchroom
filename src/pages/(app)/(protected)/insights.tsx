/**
 * InsightsPage — AI-generated themes over the board's feedback.
 *
 * Everyone signed in can read the current themes. The owner sees the
 * "Analyze feedback" button, which calls the `analyze-feedback` server
 * action: the worker gathers recent channel messages, asks Claude to
 * cluster them, and rewrites the themes collection. The page updates live
 * when the new run lands.
 */

import { useState } from 'react'
import { getAuthToken, useQuery, useUser } from 'deepspace'
import { Button } from '@/components/ui'

interface ThemeRow {
  runId: string
  title: string
  summary: string
  sentiment: string
  messageCount: string
  channels: string
  quotes: string
}

interface Quote {
  author: string
  text: string
}

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'bg-emerald-500/15 text-emerald-400',
  mixed: 'bg-amber-500/15 text-amber-400',
  negative: 'bg-red-500/15 text-red-400',
}

function parseQuotes(raw: string): Quote[] {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (q): q is Quote =>
        typeof q === 'object' &&
        q !== null &&
        typeof (q as Quote).author === 'string' &&
        typeof (q as Quote).text === 'string',
    )
  } catch {
    return []
  }
}

export default function InsightsPage() {
  const { user } = useUser()
  const { records, status } = useQuery<ThemeRow>('themes', {
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 12,
  })
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<string | null>(null)

  const isOwner = user?.role === 'admin'

  async function runAnalysis() {
    setRunning(true)
    setRunError(null)
    setLastResult(null)
    try {
      const token = await getAuthToken()
      if (!token) throw new Error('You are signed out. Sign in again and retry.')
      const res = await fetch('/api/actions/analyze-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      })
      const body = (await res.json()) as
        | { success: true; data: { themeCount: number; messagesAnalyzed: number } }
        | { success: false; error?: string }
      if (!body.success) {
        throw new Error(body.error ?? 'Analysis failed.')
      }
      setLastResult(
        `Analyzed ${body.data.messagesAnalyzed} messages into ${body.data.themeCount} themes.`,
      )
    } catch (cause) {
      setRunError(cause instanceof Error ? cause.message : 'Analysis failed.')
    } finally {
      setRunning(false)
    }
  }

  const latestRun = records[0]?.data.runId
  const latestUpdated = records[0]?.updatedAt

  return (
    <div data-testid="insights-page" className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Feedback insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Claude clusters everything on the board into the themes below.
          </p>
          {latestUpdated && (
            <p className="mt-1 text-xs text-muted-foreground">
              Last run {new Date(latestUpdated).toLocaleString()} ({latestRun})
            </p>
          )}
        </div>
        {isOwner && (
          <Button onClick={() => void runAnalysis()} disabled={running}>
            {running ? 'Analyzing...' : 'Analyze feedback'}
          </Button>
        )}
      </div>

      {runError && (
        <p role="alert" className="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {runError}
        </p>
      )}
      {lastResult && <p className="mt-4 text-sm text-emerald-400">{lastResult}</p>}

      {status === 'loading' && (
        <p className="mt-8 text-sm text-muted-foreground">Loading themes...</p>
      )}

      {status === 'ready' && records.length === 0 && (
        <div className="mt-10 rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-foreground">No analysis yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOwner
              ? 'Once the board has a few messages, run the analysis to see themes here.'
              : 'The owner has not run an analysis yet. Check back after the first one.'}
          </p>
        </div>
      )}

      <div className="mt-6 space-y-4 pb-10">
        {records.map((record) => {
          const theme = record.data
          const quotes = parseQuotes(theme.quotes)
          return (
            <article
              key={record.recordId}
              className="rounded-lg border border-border bg-card p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-semibold text-foreground">{theme.title}</h2>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    SENTIMENT_STYLES[theme.sentiment] ?? SENTIMENT_STYLES.mixed
                  }`}
                >
                  {theme.sentiment}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{theme.summary}</p>
              {quotes.length > 0 && (
                <ul className="mt-3 space-y-2 border-l-2 border-border pl-3">
                  {quotes.map((quote, i) => (
                    <li key={i} className="text-sm text-muted-foreground">
                      <span className="italic">"{quote.text}"</span>
                      <span className="ml-1 text-xs">— {quote.author}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                {theme.messageCount} message{theme.messageCount === '1' ? '' : 's'}
                {theme.channels ? ` · #${theme.channels.split(', ').join(' #')}` : ''}
              </p>
            </article>
          )
        })}
      </div>
    </div>
  )
}
