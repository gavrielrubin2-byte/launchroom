/**
 * Launchroom home — a short orientation page with live counts.
 */

import { Link } from 'react-router-dom'
import { useAuthProfileReady, usePresence, useQuery } from 'deepspace'

interface MessageRow {
  content: string
  deleted?: boolean
}

interface ThemeRow {
  title: string
}

export default function HomePage() {
  const { user } = useAuthProfileReady({ requireUser: true })
  const { records: messages } = useQuery<MessageRow>('messages', { limit: 200 })
  const { records: themes } = useQuery<ThemeRow>('themes', { limit: 12 })
  const { users, isOnline } = usePresence()
  const onlineCount = users.filter((u) => isOnline(u.id)).length
  const feedbackCount = messages.filter((m) => !m.data.deleted).length

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Welcome to Launchroom{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          This is where our launch feedback lives. Tell us what landed and what
          didn't on the board, and Claude turns the whole conversation into
          themes on the insights page.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-semibold text-foreground">{feedbackCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">feedback messages</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-semibold text-foreground">{themes.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">themes from the last run</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-semibold text-foreground">{onlineCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">people online now</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          to="/board"
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Go to the board
        </Link>
        <Link
          to="/insights"
          className="rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        >
          See insights
        </Link>
      </div>
    </div>
  )
}
