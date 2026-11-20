/**
 * BoardPage — Launchroom's feedback board.
 *
 * A small set of public feedback channels (seeded on first visit) with the
 * messaging feature's chat UI on the right. The strip above the messages
 * shows who is online (users-collection heartbeats via usePresence) and who
 * is looking at this channel right now (ephemeral PresenceRoom state via
 * usePresenceRoom).
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  isWriterRole,
  useChannels,
  usePresence,
  usePresenceRoom,
  useReadReceipts,
  useUser,
} from 'deepspace'
import type { Channel, RecordData } from 'deepspace'
import { ChatHeader } from '../../../components/messaging/chat/ChatHeader'
import { MessageList } from '../../../components/messaging/chat/MessageList'

const SEED_CHANNELS: { name: string; description: string }[] = [
  { name: 'first-impressions', description: 'What was your first reaction?' },
  { name: 'bugs', description: 'Something broken? Report it here.' },
  { name: 'feature-ideas', description: 'What should we build next?' },
]

export default function BoardPage() {
  const { user } = useUser()
  const { channels, status, create } = useChannels()
  const { markAsRead, receipts } = useReadReceipts()
  const [activeId, setActiveId] = useState<string | null>(null)
  const seededRef = useRef(false)
  const lastMarkedRef = useRef<string | null>(null)

  const publicChannels = useMemo(
    () =>
      channels
        .filter((c: RecordData<Channel>) => c.data.type === 'public' && !c.data.archived)
        .sort(
          (a: RecordData<Channel>, b: RecordData<Channel>) =>
            a.createdAt.localeCompare(b.createdAt) || a.recordId.localeCompare(b.recordId),
        ),
    [channels],
  )

  // One-shot seed: a writer role creates the three feedback channels the
  // first time the board loads empty. Duplicates from a race are hidden by
  // the name filter below when picking the active channel.
  const canCreate = isWriterRole(user?.role)
  useEffect(() => {
    if (!canCreate || status !== 'ready' || seededRef.current) return
    seededRef.current = true
    const existing = new Set(publicChannels.map((c) => c.data.name))
    for (const seed of SEED_CHANNELS) {
      if (!existing.has(seed.name)) {
        void create(seed).catch(() => {
          seededRef.current = false
        })
      }
    }
  }, [canCreate, status, publicChannels, create])

  // Default to the first seeded channel once channels exist.
  useEffect(() => {
    if (activeId === null && publicChannels.length > 0) {
      setActiveId(publicChannels[0].recordId)
    }
  }, [activeId, publicChannels])

  const canTrackReadState = isWriterRole(user?.role)
  useEffect(() => {
    if (!activeId || !canTrackReadState) return
    if (lastMarkedRef.current === activeId) return
    lastMarkedRef.current = activeId
    // markAsRead inserts a receipt row; calling it twice for the same
    // channel+user violates the collection's uniqueness rule and surfaces a
    // duplicate-record toast, so only mark channels with no receipt yet.
    const alreadyMarked = receipts.some((r) => r.data.channelId === activeId)
    if (!alreadyMarked) markAsRead(activeId)
  }, [activeId, canTrackReadState, markAsRead, receipts])

  if (status !== 'ready') {
    return (
      <div data-testid="board-loading" className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading the board...</div>
      </div>
    )
  }

  return (
    <div data-testid="board-page" className="grid h-full grid-cols-[240px_1fr]">
      <aside className="flex flex-col border-r border-border bg-card/40">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Feedback channels</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Launch feedback, good or bad — we read everything.
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          {publicChannels.map((channel) => (
            <button
              key={channel.recordId}
              onClick={() => setActiveId(channel.recordId)}
              className={`mb-1 w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                channel.recordId === activeId
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <span className="font-medium"># {channel.data.name}</span>
              {channel.data.description && (
                <span className="mt-0.5 block text-xs opacity-70">{channel.data.description}</span>
              )}
            </button>
          ))}
          {publicChannels.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">Setting up channels...</p>
          )}
        </nav>
      </aside>
      <main className="flex min-w-0 flex-col">
        {activeId ? (
          <>
            <PresenceStrip scopeId={`board:${activeId}`} />
            <ChatHeader channelId={activeId} />
            <MessageList channelId={activeId} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Pick a channel to join the feedback.</p>
          </div>
        )}
      </main>
    </div>
  )
}

function PresenceStrip({ scopeId }: { scopeId: string }) {
  const { users, isOnline } = usePresence()
  const { peers } = usePresenceRoom(scopeId)
  const online = users.filter((u) => isOnline(u.id))
  const viewing = peers.length

  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
        {online.length} online
      </span>
      {viewing > 0 && (
        <span>
          {viewing} other{viewing === 1 ? '' : 's'} viewing this channel
        </span>
      )}
      <span className="ml-auto hidden sm:inline">
        {online
          .slice(0, 4)
          .map((u) => u.name)
          .join(', ')}
        {online.length > 4 ? ` +${online.length - 4}` : ''}
      </span>
    </div>
  )
}
