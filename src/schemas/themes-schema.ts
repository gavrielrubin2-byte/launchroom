/**
 * Launchroom — Themes schema
 *
 * AI-generated feedback themes. Written only by the `analyze-feedback`
 * server action (which runs RBAC-off and gates on the admin role itself),
 * so client-side writes are closed for every role. Members can read themes;
 * signed-out visitors see nothing.
 */

import type { CollectionSchema } from 'deepspace/schema'

export const themesSchema: CollectionSchema = {
  name: 'themes',
  columns: [
    { name: 'runId', storage: 'text', interpretation: 'plain' },
    { name: 'title', storage: 'text', interpretation: 'plain' },
    { name: 'summary', storage: 'text', interpretation: 'plain' },
    { name: 'sentiment', storage: 'text', interpretation: 'plain' },
    { name: 'messageCount', storage: 'text', interpretation: 'plain' },
    { name: 'channels', storage: 'text', interpretation: 'plain' },
    // JSON array of { author: string; text: string } — kept as one text
    // column because themes are read whole, never queried by quote.
    { name: 'quotes', storage: 'text', interpretation: 'plain' },
  ],
  permissions: {
    viewer: { read: true, create: false, update: false, delete: false },
    member: { read: true, create: false, update: false, delete: false },
    admin: { read: true, create: true, update: true, delete: true },
  },
}
