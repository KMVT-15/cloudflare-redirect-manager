"use client";

import { useEffect, useState } from "react";
import type { Redirect } from "@/lib/cloudflare";
import { normalizePath, normalizeUrl } from "@/lib/url";

type Data = { domain: string; redirects: Redirect[] };

const message = (error: unknown) => (error instanceof Error ? error.message : "Something went wrong");

export default function Home() {
  const [data, setData] = useState<Data | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    send("/api/redirects", "GET").catch((problem) => setError(message(problem)));
  }, []);

  async function send(url: string, method: string, body?: object) {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body && JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error);
    setData(payload);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-5 p-6 sm:justify-center">
      <header>
        <h1 className="text-2xl font-semibold">Redirects</h1>
        <p className="text-sm opacity-70">
          Choose where short links on {data ? data.domain : "your site"} send visitors.
        </p>
      </header>

      {!data && !error && <p className="text-sm opacity-60">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {data?.redirects.map((redirect) => (
        <Card
          key={redirect.id}
          domain={data.domain}
          redirect={redirect}
          onSave={(body) => send(`/api/redirects/${redirect.id}`, "PUT", body)}
          onDelete={() => send(`/api/redirects/${redirect.id}`, "DELETE")}
        />
      ))}

      {drafting && data && (
        <Card
          domain={data.domain}
          onSave={async (body) => {
            await send("/api/redirects", "POST", body);
            setDrafting(false);
          }}
          onCancel={() => setDrafting(false)}
        />
      )}

      {data && !drafting && (
        <button
          onClick={() => setDrafting(true)}
          className="self-start rounded-md border border-dashed border-black/25 px-4 py-2 text-sm transition hover:border-blue-500 hover:text-blue-600 dark:border-white/25"
        >
          + New redirect
        </button>
      )}
    </main>
  );
}

type CardProps = {
  domain: string;
  redirect?: Redirect;
  onSave: (body: { path: string; targetUrl: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onCancel?: () => void;
};

function Card({ domain, redirect, onSave, onDelete, onCancel }: CardProps) {
  const [path, setPath] = useState(redirect?.path ?? "");
  const [targetUrl, setTargetUrl] = useState(redirect?.targetUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState("");

  const isNew = !redirect;
  const changed = isNew || path !== redirect.path || targetUrl !== redirect.targetUrl;

  function tidy(value: string, clean: (input: string) => string, apply: (result: string) => void) {
    if (!value.trim()) return;
    try {
      apply(clean(value));
      setProblem("");
    } catch (error) {
      setProblem(message(error));
    }
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setProblem("");
    try {
      await action();
    } catch (error) {
      setProblem(message(error));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "min-w-0 rounded-md border border-black/15 bg-transparent px-2 py-1 font-mono text-sm outline-none focus:border-blue-500 dark:border-white/20";

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(() => onSave({ path, targetUrl }));
      }}
      className="flex flex-col gap-3 rounded-lg border border-black/10 p-4 dark:border-white/15"
    >
      <div className="flex items-center gap-1 font-mono text-sm">
        <span className="shrink-0 opacity-60">{domain}</span>
        <input
          value={path}
          onChange={(event) => setPath(event.target.value)}
          onBlur={() => tidy(path, normalizePath, setPath)}
          placeholder="/live"
          autoFocus={isNew}
          spellCheck={false}
          className={`${field} flex-1`}
        />
        <span className="shrink-0 text-xs opacity-50">{redirect?.statusCode ?? 302}</span>
      </div>

      <label className="flex flex-col gap-1 text-xs opacity-60">
        Sends visitors to
        <input
          value={targetUrl}
          onChange={(event) => setTargetUrl(event.target.value)}
          onBlur={() => tidy(targetUrl, normalizeUrl, setTargetUrl)}
          placeholder="youtube.com/@KMVT15/streams"
          spellCheck={false}
          className={`${field} text-black opacity-100 dark:text-white`}
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !changed}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
        >
          {busy ? "Saving…" : isNew ? "Create" : "Save"}
        </button>

        {isNew ? (
          <button type="button" onClick={onCancel} className="text-sm opacity-70 hover:opacity-100">
            Cancel
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => (confirming ? run(onDelete!) : setConfirming(true))}
            onBlur={() => setConfirming(false)}
            className="ml-auto text-sm text-red-600 hover:underline disabled:opacity-40"
          >
            {confirming ? "Really delete?" : "Delete"}
          </button>
        )}
      </div>

      {problem && <p className="text-sm text-red-600">{problem}</p>}
    </form>
  );
}
