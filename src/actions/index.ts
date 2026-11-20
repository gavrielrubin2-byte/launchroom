/**
 * Launchroom — server actions.
 *
 * `analyze-feedback` is the app's one privileged operation: it reads recent
 * channel messages, asks Claude to cluster them into themes, and replaces
 * the `themes` collection with the result. Actions run RBAC-off (see
 * src/server/action-routes.ts), so the role check below is the only thing
 * standing between this action and every user's data. Owner or admin only.
 */

import { generateText } from 'ai'
import { createDeepSpaceAI, resolveAppRole } from 'deepspace/worker'
import type { ActionHandler } from 'deepspace/worker'
import type { Env } from '../../worker'

type ChannelRow = Record<string, unknown> & {
  name: string
  description?: string
}

type MessageRow = Record<string, unknown> & {
  channelId: string
  authorId: string
  content: string
  deleted?: boolean
}

type UserRow = Record<string, unknown> & {
  name?: string
  email?: string
}

interface ThemeOut {
  title: string
  summary: string
  sentiment: 'positive' | 'mixed' | 'negative'
  messageCount: number
  channels: string[]
  quotes: { author: string; text: string }[]
}

function extractJsonArray(text: string): unknown[] {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start < 0 || end <= start) throw new Error('Model returned no JSON array')
  const parsed: unknown = JSON.parse(text.slice(start, end + 1))
  if (!Array.isArray(parsed)) throw new Error('Model output was not an array')
  return parsed
}

function asTheme(value: unknown): ThemeOut | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  if (typeof v.title !== 'string' || typeof v.summary !== 'string') return null
  const sentiment =
    v.sentiment === 'positive' || v.sentiment === 'negative' ? v.sentiment : 'mixed'
  const quotes = Array.isArray(v.quotes)
    ? v.quotes
        .filter(
          (q): q is { author: string; text: string } =>
            typeof q === 'object' &&
            q !== null &&
            typeof (q as Record<string, unknown>).author === 'string' &&
            typeof (q as Record<string, unknown>).text === 'string',
        )
        .slice(0, 3)
    : []
  return {
    title: v.title.slice(0, 80),
    summary: v.summary.slice(0, 600),
    sentiment,
    messageCount:
      typeof v.messageCount === 'number' && Number.isFinite(v.messageCount)
        ? Math.max(0, Math.round(v.messageCount))
        : 0,
    channels: Array.isArray(v.channels)
      ? v.channels.filter((c): c is string => typeof c === 'string').slice(0, 6)
      : [],
    quotes,
  }
}

const analyzeFeedback: ActionHandler<Env> = async ({ userId, tools, env }) => {
  const isOwner = userId === env.OWNER_USER_ID
  const role = isOwner ? 'admin' : await resolveAppRole(env, userId)
  if (!isOwner && role !== 'admin') {
    return { success: false, code: 'forbidden', error: 'Only the app owner can run analysis.' }
  }

  const [channelsRes, messagesRes, usersRes] = await Promise.all([
    tools.query<ChannelRow>('channels', { limit: 50 }),
    tools.query<MessageRow>('messages', { orderBy: 'createdAt', orderDir: 'desc', limit: 200 }),
    tools.query<UserRow>('users', { limit: 200 }),
  ])
  if (!channelsRes.success || !messagesRes.success) {
    return {
      success: false,
      code: 'read_failed',
      error: 'Could not read channels and messages for analysis.',
    }
  }

  const channelNames = new Map<string, string>()
  for (const row of channelsRes.data?.records ?? []) {
    channelNames.set(row.recordId, row.data.name)
  }
  const authorNames = new Map<string, string>()
  for (const row of usersRes.data?.records ?? []) {
    authorNames.set(row.recordId, row.data.name ?? row.data.email ?? 'Someone')
  }

  const usable = (messagesRes.data?.records ?? []).filter(
    (m) => !m.data.deleted && m.data.content.trim().length > 0,
  )
  if (usable.length < 3) {
    return {
      success: false,
      code: 'not_enough_feedback',
      error: `Only ${usable.length} feedback message(s) so far — analysis needs at least 3.`,
    }
  }

  const transcript = usable
    .slice(0, 150)
    .map((m) => {
      const channel = channelNames.get(m.data.channelId) ?? 'unknown'
      const author = authorNames.get(m.data.authorId) ?? 'Someone'
      return `[#${channel}] ${author}: ${m.data.content.replace(/\s+/g, ' ').slice(0, 400)}`
    })
    .join('\n')

  const ai = createDeepSpaceAI(env, 'anthropic')
  const result = await generateText({
    model: ai('claude-haiku-5-5'),
    messages: [
      {
        role: 'user',
        content: [
          'You are analyzing user feedback for a product launch board.',
          'Cluster the feedback messages below into 3 to 6 themes.',
          'Return ONLY a JSON array (no markdown fences) where each item has:',
          '- "title": short theme name (max 8 words)',
          '- "summary": 2-3 sentences on what users are saying and why it matters',
          '- "sentiment": one of "positive", "mixed", "negative"',
          '- "messageCount": how many of the messages belong to this theme',
          '- "channels": the channel names (without #) where the theme appears',
          '- "quotes": up to 3 short verbatim quotes as {"author", "text"}',
          '',
          'Feedback messages:',
          transcript,
        ].join('\n'),
      },
    ],
  })

  let themes: ThemeOut[]
  try {
    themes = extractJsonArray(result.text)
      .map(asTheme)
      .filter((t): t is ThemeOut => t !== null)
      .slice(0, 6)
  } catch {
    return {
      success: false,
      code: 'parse_failed',
      error: 'The model response could not be parsed. Try running the analysis again.',
    }
  }
  if (themes.length === 0) {
    return {
      success: false,
      code: 'parse_failed',
      error: 'The model returned no usable themes. Try running the analysis again.',
    }
  }

  // Replace the previous run: remove existing theme rows, then write the
  // new set. Bounded at 500 rows; this collection only ever holds one run.
  const drain = await tools.query<{ runId: string }>('themes', { limit: 500 })
  for (const row of drain.data?.records ?? []) {
    await tools.remove('themes', row.recordId)
  }

  const runId = `run-${Date.now()}`
  for (const theme of themes) {
    const created = await tools.create('themes', {
      runId,
      title: theme.title,
      summary: theme.summary,
      sentiment: theme.sentiment,
      messageCount: String(theme.messageCount),
      channels: theme.channels.join(', '),
      quotes: JSON.stringify(theme.quotes),
    })
    if (!created.success) {
      return {
        success: false,
        code: 'write_failed',
        error: 'Analysis finished but saving the themes failed.',
      }
    }
  }

  return {
    success: true,
    data: { runId, themeCount: themes.length, messagesAnalyzed: usable.length },
  }
}

export const actions: Record<string, ActionHandler<Env>> = {
  'analyze-feedback': analyzeFeedback,
}
