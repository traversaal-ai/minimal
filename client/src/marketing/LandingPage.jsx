import React from 'react';
import { Link } from 'react-router-dom';

const HERO_SLIDES = [
  { src: '/hero/pages.jpg', label: 'Pages, grouped the way your team thinks',
    alt: 'A workspace dashboard with pages grouped into named sections' },
  { src: '/hero/tables.jpg', label: 'Tables with real structure, not screenshots of one',
    alt: 'A table of customers with contact, plan and coloured status columns' },
  { src: '/hero/graph.jpg', label: 'And a map of how all of it connects',
    alt: 'A graph of the workspace, pages as dots joined by the links between them' },
];

function HeroSlider() {
  const [i, setI] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (paused) return undefined;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const id = setInterval(() => setI((n) => (n + 1) % HERO_SLIDES.length), 4200);
    return () => clearInterval(id);
  }, [paused]);

  return (
    <div
      className="w-full max-w-xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <div className="h-3 w-3 rounded-full bg-red-300" />
          <div className="h-3 w-3 rounded-full bg-yellow-300" />
          <div className="h-3 w-3 rounded-full bg-green-300" />
        </div>
        <div className="relative aspect-[16/11] bg-white">
          {HERO_SLIDES.map((s, n) => (
            <img
              key={s.src}
              src={s.src}
              alt={s.alt}
              className="absolute inset-0 h-full w-full object-contain object-top transition-opacity duration-500"
              style={{ opacity: n === i ? 1 : 0 }}
              aria-hidden={n === i ? undefined : true}
            />
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div className="flex gap-2">
          {HERO_SLIDES.map((s, n) => (
            <button
              key={s.src}
              type="button"
              onClick={() => setI(n)}
              aria-label={s.label}
              aria-current={n === i}
              className={`h-2 rounded-full transition-all ${
                n === i ? 'w-6 bg-accent' : 'w-2 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-gray-500">{HERO_SLIDES[i].label}</p>
      </div>
    </div>
  );
}

function TreeMockup() {
  const rows = [
    { label: 'Onboarding', depth: 0, bold: true },
    { label: 'Week 1 checklist', depth: 1 },
    { label: 'Tools we use', depth: 1 },
    { label: 'Team norms', depth: 0, bold: true },
    { label: 'Roadmap', depth: 0, bold: true },
    { label: 'Q3 goals', depth: 1 },
  ];

  return (
    <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-red-300" />
        <div className="h-3 w-3 rounded-full bg-yellow-300" />
        <div className="h-3 w-3 rounded-full bg-green-300" />
      </div>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
            style={{ paddingLeft: `${row.depth * 20 + 8}px` }}
          >
            <span className="text-gray-400">{row.depth === 0 ? '▸' : '·'}</span>
            <span className={row.bold ? 'font-medium text-gray-900' : ''}>{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-lg text-accent">
        {icon}
      </div>
      <h3 className="mb-2 text-base font-semibold text-gray-900">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-500">{description}</p>
    </div>
  );
}

function Step({ number, title, description }) {
  return (
    <div className="flex-1">
      <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
        {number}
      </div>
      <h3 className="mb-2 text-base font-semibold text-gray-900">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-500">{description}</p>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="border-b border-gray-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">Minimal</span>
          <nav className="flex items-center gap-3">
            <Link
              to="/login"
              data-testid="nav-login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              data-testid="nav-signup"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <h1 className="text-4xl font-semibold leading-tight tracking-tight text-gray-900 sm:text-5xl">
Notion meets Obsidian
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-500">
              Notion gives you the pages. Obsidian shows you how they connect. Minimal
              does both, on a server you control: nested pages, tables and checklists your
              team edits together, a list on every page of what links to it, and a graph of
              the whole workspace. Nothing leaves your machine.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/signup"
                data-testid="hero-cta-signup"
                className="rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent-dark"
              >
                Get started free
              </Link>
              <Link
                to="/login"
                data-testid="hero-login"
                className="rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 transition hover:border-gray-400"
              >
                Log in
              </Link>
              <Link
                to="/demo"
                data-testid="guest-cta"
                className="text-sm font-medium text-gray-500 underline decoration-gray-300 underline-offset-4 transition hover:text-accent"
              >
                Continue as guest →
              </Link>
            </div>
          </div>
          <div className="flex justify-center md:justify-end">
            <HeroSlider />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
The part of Notion you actually use
            </h2>
            <p className="mt-4 text-base text-gray-500">
              No plans to compare, no seats to buy, no features you will never open.
              Pages, tables, checklists, a workspace your team joins by email, and the
              links between all of it drawn as a map.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <FeatureCard
              icon="⌂"
              title="Nested pages"
              description="Build a tree of pages under pages: onboarding docs, sub-pages for each topic, as deep as you need."
            />
            <FeatureCard
              icon="⬡"
              title="Shared workspace"
              description="Invite teammates by email. Everyone in the workspace can view and edit every page, with no ownership lock."
            />
            <FeatureCard
              icon="▤"
              title="Real blocks, including tables"
              description="Text, headings, checklists, and tables with a Notion-style row view. Enough structure for real documentation."
            />
            <FeatureCard
              icon="◈"
              title="Backlinks and a graph"
              description="Every page lists what links to it. The whole workspace draws itself as a graph, out of links you already wrote."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900">How it works</h2>
          </div>
          <div className="grid gap-10 sm:grid-cols-3">
            <Step
              number="1"
              title="Sign up"
              description="Create an account and land in your own workspace. No setup, no configuration."
            />
            <Step
              number="2"
              title="Write and nest pages"
              description="Create a page, nest it under another, add text, tables and checklists. Link one page to another and the graph redraws itself."
            />
            <Step
              number="3"
              title="Invite your team"
              description="Add teammates by email. They see and edit the same page tree the moment they sign up."
            />
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-8 text-center text-xs font-medium uppercase tracking-wider text-gray-400">
            Trusted by small teams everywhere
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6 text-xl font-semibold tracking-tight text-gray-300">
            <span>Northwind</span>
            <span>Argon Labs</span>
            <span>Fieldnote</span>
            <span>Harbor &amp; Co</span>
            <span>Loom Studio</span>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
            Put it on your own server
          </h2>
          <p className="mt-4 text-base text-gray-500">
            Clone it, run two commands, and it is live. Your data stays on your machine.
          </p>
          <div className="mt-8">
            <Link
              to="/signup"
              className="inline-block rounded-lg bg-accent px-6 py-3 text-sm font-medium text-white transition hover:bg-accent-dark"
            >
              Get started free
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 sm:grid-cols-4">
            <div>
              <span className="text-lg font-semibold tracking-tight text-gray-900">Minimal</span>
              <p className="mt-3 text-sm text-gray-500">Notion's pages. Obsidian's graph. Your server.</p>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900">Product</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>Nested pages</li>
                <li>Shared workspace</li>
                <li>Checklists</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900">Company</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>About</li>
                <li>Blog</li>
                <li>Careers</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-gray-900">Resources</h4>
              <ul className="space-y-2 text-sm text-gray-500">
                <li>Docs</li>
                <li>Self-hosting guide</li>
                <li>Support</li>
              </ul>
            </div>
          </div>
          <p className="mt-12 text-xs text-gray-400">© 2026 Minimal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
