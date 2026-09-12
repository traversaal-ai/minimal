import React from 'react';
import { Link } from 'react-router-dom';

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
A self-hosted wiki, inspired by Notion, sized for a small team
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-500">
              Minimal is a simplified alternative inspired by Notion, built around what a
              small team actually uses: nested pages, tables, checklists, and a shared
              workspace teammates join by email. Fully self-hosted, with no external accounts
              required.
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
            <TreeMockup />
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-gray-100 bg-gray-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-14 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight text-gray-900">
Inspired by Notion's core loop, none of the rest
            </h2>
            <p className="mt-4 text-base text-gray-500">
              No accounts to manage, no pricing tiers, no feature bloat. Just the nested
              pages, tables, and shared editing your team actually uses.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              description="Create a page, nest it under another, and add text, heading, or checklist blocks."
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
            Start your team's wiki today
          </h2>
          <p className="mt-4 text-base text-gray-500">
            Free, self-hosted, and ready in under a minute.
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
              <p className="mt-3 text-sm text-gray-500">A self-hosted wiki, inspired by Notion.</p>
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
