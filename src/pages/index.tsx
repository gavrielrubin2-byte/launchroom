/**
 * Landing page — a STATIC page (see the scaffold note: no providers, no auth
 * fetch, prerendered at build). Keep it renderable without a browser.
 */

import { Link } from 'react-router-dom'
import { Seo } from '../components/Seo'
import { seo } from '../seo'

export default function Landing() {
  return (
    <>
      <Seo {...seo} path="/" />
      <div
        data-testid="static-landing"
        className="flex min-h-screen flex-col items-center justify-center px-6 text-center"
      >
        <p className="mb-3 text-sm uppercase tracking-widest text-muted-foreground">
          Launchroom
        </p>
        <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Launch feedback, clustered into what matters
        </h1>
        <p className="mb-8 max-w-lg text-muted-foreground">
          Launchroom gives a small team one real-time board for everything users
          say after a launch. Claude reads the whole board and pulls out the
          themes, the sentiment, and the quotes worth quoting — so the next
          decision takes minutes, not a spreadsheet.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/home"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            Enter the app
          </Link>
          <a
            href="https://docs.deep.space"
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Built on DeepSpace
          </a>
        </div>
        <dl className="mt-14 grid max-w-3xl grid-cols-1 gap-6 text-left sm:grid-cols-3">
          <div>
            <dt className="text-sm font-semibold text-foreground">Real-time channels</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              First impressions, bugs, and feature ideas each get a channel with
              reactions, threads, and read receipts.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-foreground">Live presence</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              See who is online and who is reading a channel while the launch is
              happening.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-foreground">AI themes</dt>
            <dd className="mt-1 text-sm text-muted-foreground">
              One click clusters the whole board into themes with sentiment and
              representative quotes.
            </dd>
          </div>
        </dl>
      </div>
    </>
  )
}
