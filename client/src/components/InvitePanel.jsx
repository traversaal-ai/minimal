import React, { useEffect, useState } from 'react';
import * as api from '../api/client.js';

export default function InvitePanel({ onClose }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const loadMembers = async () => {
    setLoadingMembers(true);
    try {
      const data = await api.getMembers();
      setMembers(data.members || []);
    } catch (err) {
      // ignore, non-critical
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setConfirmed(false);

    if (!email.trim()) {
      setError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      await api.inviteTeammate(email.trim());
      setConfirmed(true);
      setEmail('');
      loadMembers();
    } catch (err) {
      setError(err?.message || 'Please enter a valid email address.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center bg-black/30 pt-24">
      <div data-testid="invite-panel" className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Invite a teammate</h2>
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            data-testid="invite-email-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@team.com"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            data-testid="invite-button"
            disabled={submitting}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-60"
          >
            Invite
          </button>
        </form>

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {confirmed && (
          <p data-testid="invite-confirmation" className="mt-2 text-sm text-accent">
            Invite sent. They'll see this workspace as soon as they sign up or log in.
          </p>
        )}

        <div className="mt-6">
          <h3 className="mb-2 text-sm font-medium text-gray-700">Members</h3>
          {loadingMembers ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : (
            <ul className="space-y-1">
              {members.map((m) => (
                <li key={m.id} className="text-sm text-gray-600">
                  {m.email}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
