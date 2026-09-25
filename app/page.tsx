"use client";

import { useEffect, useState } from "react";

type Redirect = {
  requestUrl: string;
  targetUrl: string;
  statusCode: number;
};

export default function Home() {
  const [redirect, setRedirect] = useState<Redirect | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const response = await fetch("/api/redirect");
    const data = await response.json();

    if (response.ok) {
      setRedirect(data);
      setDraft(data.targetUrl);
    } else {
      setMessage({ text: data.error, ok: false });
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/redirect", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUrl: draft.trim() }),
    });
    const data = await response.json();

    if (response.ok) {
      setRedirect(data);
      setDraft(data.targetUrl);
      setMessage({ text: "Redirect updated", ok: true });
    } else {
      setMessage({ text: data.error, ok: false });
    }

    setSaving(false);
  }

  const unchanged = !redirect || draft.trim() === redirect.targetUrl;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Live stream redirect</h1>
        <p className="text-sm opacity-70">
          Choose where kmvt15.org/live sends viewers.
        </p>
      </header>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/15">
        <h2 className="text-xs font-medium uppercase tracking-wide opacity-60">Currently pointing to</h2>
        <p className="mt-2 break-all font-mono text-sm">
          {redirect ? redirect.targetUrl : "Loading…"}
        </p>
        {redirect && (
          <p className="mt-3 text-xs opacity-60">
            {redirect.requestUrl} · {redirect.statusCode} redirect
          </p>
        )}
      </section>

      <form onSubmit={save} className="flex flex-col gap-3">
        <label htmlFor="target" className="text-sm font-medium">
          New destination
        </label>
        <input
          id="target"
          type="url"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="https://www.youtube.com/@KMVT15/streams"
          required
          disabled={!redirect}
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-blue-500 disabled:opacity-50 dark:border-white/20"
        />
        <button
          type="submit"
          disabled={saving || unchanged}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Update redirect"}
        </button>
      </form>

      {message && (
        <p className={`text-sm ${message.ok ? "text-green-600" : "text-red-600"}`}>
          {message.text}
        </p>
      )}
    </main>
  );
}
