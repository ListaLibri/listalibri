"use client";

import { useEffect, useMemo, useState } from "react";

type Result = {
  comune: string;
  provincia: string;
  scuola: string;
  codiceIstituto: string;
  codiceScuola: string;
};

export default function CercaPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [mode, setMode] = useState<string>("");

  const canSearch = useMemo(() => q.trim().length >= 2, [q]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!canSearch) {
        setResults([]);
        setMode("");
        return;
      }
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      setResults(json.results ?? []);
      setMode(json.mode ?? "");
    }, 250);

    return () => clearTimeout(t);
  }, [q, canSearch]);

  return (
    <main className="min-h-screen bg-slate-50 font-sans">
  <div className="mx-auto max-w-3xl px-6 py-8">

      <h1 className="text-3xl font-semibold text-slate-900">Cerca la tua classe</h1>
      <p className="mt-2 text-slate-700">
        Scrivi la scuola e il comune (es. <b>Carducci Roma</b>).
      </p>

      <input
  value={q}
  onChange={(e) => setQ(e.target.value)}
  placeholder='Es: "einstein potenza", "da vinci", "PZIS022008"'
  className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
 />

      <div className="mt-3" />

      <div className="mt-4 grid gap-3">
  {results.map((r, i) => (
    <div
      key={`${r.codiceScuola}-${i}`}
className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      {/* Scuola */}
      <div className="text-base font-semibold text-slate-900">{r.scuola}</div>

      {/* Comune / Provincia / Codice istituto */}
      <div className="mt-1 text-sm text-slate-700">
        {r.comune} ({r.provincia}) ·{" "}
        <span className="font-medium text-slate-800">IST:</span>{" "}
        <span className="font-mono text-slate-800">{r.codiceIstituto}</span>
      </div>
      {/* Codice scuola */}
      <div className="mt-2 text-xs text-slate-600">
        Codice scuola:{" "}
        <span className="font-mono text-slate-700">{r.codiceScuola}</span>
      </div>
    </div>
  ))}

{canSearch && results.length === 0 ? (
  <div className="mt-3 text-sm text-slate-700">
    Nessun risultato. Prova a scrivere anche il comune o il codice meccanografico.
  </div>
) : null}
        </div>
      </div>
    </main>
    );
  }