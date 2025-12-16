import fs from "fs";
import path from "path";

type Row = {
  CODICESCUOLA: string;
  CODICEISTITUTORIFERIMENTO: string;
  DENOMINAZIONESCUOLA: string;
  DENOMINAZIONEISTITUTORIFERIMENTO: string;
  DESCRIZIONECOMUNE: string;
  PROVINCIA: string;
  CLASSE_DISPLAY: string;
};

function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // rimuove accenti
    .replace(/[.,;:\-_\/\\’'"()\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// parsing CSV semplice (dato che i campi qui non contengono virgole “problematiche” nella maggior parte dei casi)
function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  return lines.map((line) => {
    // split “naive”: se dovessimo trovare virgolette/virgole interne, passiamo a un parser robusto
    return line.split(",");
  });
}

let CACHE: { rows: Row[]; ready: boolean } | null = null;

function loadData(): Row[] {
  if (CACHE?.ready) return CACHE.rows;

  const filePath = path.join(process.cwd(), "data", "classi_basilicata_con_istituto.csv");
  const raw = fs.readFileSync(filePath, "utf-8");

  const table = parseCSV(raw);
  const header = table[0];
  const idx = (name: string) => header.indexOf(name);

  const required = [
    "CODICESCUOLA",
    "CODICEISTITUTORIFERIMENTO",
    "DENOMINAZIONESCUOLA",
    "DENOMINAZIONEISTITUTORIFERIMENTO",
    "DESCRIZIONECOMUNE",
    "PROVINCIA",
    "CLASSE_DISPLAY",
  ];

  for (const col of required) {
    if (idx(col) === -1) throw new Error(`Colonna mancante nel CSV: ${col}`);
  }

  const rows: Row[] = table.slice(1).map((r) => ({
    CODICESCUOLA: r[idx("CODICESCUOLA")] ?? "",
    CODICEISTITUTORIFERIMENTO: r[idx("CODICEISTITUTORIFERIMENTO")] ?? "",
    DENOMINAZIONESCUOLA: r[idx("DENOMINAZIONESCUOLA")] ?? "",
    DENOMINAZIONEISTITUTORIFERIMENTO: r[idx("DENOMINAZIONEISTITUTORIFERIMENTO")] ?? "",
    DESCRIZIONECOMUNE: r[idx("DESCRIZIONECOMUNE")] ?? "",
    PROVINCIA: r[idx("PROVINCIA")] ?? "",
    CLASSE_DISPLAY: r[idx("CLASSE_DISPLAY")] ?? "",
  }));

  CACHE = { rows, ready: true };
  return rows;
}

function looksLikeCode(q: string): boolean {
  const up = q.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2}[A-Z0-9]{7,10}$/.test(up);
}

function score(query: string, row: Row): number {
  const q = normalize(query);
  const tokens = q.split(" ").filter(Boolean);
  if (!tokens.length) return 0;

  const commune = normalize(row.DESCRIZIONECOMUNE);
  const prov = normalize(row.PROVINCIA);
  const hay = normalize(
    `${row.DENOMINAZIONESCUOLA} ${row.DESCRIZIONECOMUNE} ${row.PROVINCIA} ${row.CLASSE_DISPLAY} ${row.DENOMINAZIONEISTITUTORIFERIMENTO}`
  );

  let s = 0;
  for (const t of tokens) {
    if (hay.includes(t)) s += 1;
  }

  // bonus: comune > provincia
  for (const t of tokens) {
    if (commune === t) s += 3;
    if (prov === t) s += 1;
  }

  return s;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (!q) return Response.json({ results: [] });

  const rows = loadData();

  // branch “codice meccanografico”
  if (looksLikeCode(q)) {
    const up = q.replace(/\s+/g, "").toUpperCase();
    const exactSchool = rows.filter((r) => (r.CODICESCUOLA ?? "").toUpperCase() === up);
    if (exactSchool.length) {
      return Response.json({
        results: exactSchool.slice(0, 20).map((r) => ({
          comune: r.DESCRIZIONECOMUNE,
          provincia: r.PROVINCIA,
          scuola: r.DENOMINAZIONESCUOLA,
          classe: r.CLASSE_DISPLAY,
          codiceIstituto: r.CODICEISTITUTORIFERIMENTO,
          codiceScuola: r.CODICESCUOLA,
        })),
        mode: "CODICESCUOLA",
      });
    }

    const exactInst = rows.filter((r) => (r.CODICEISTITUTORIFERIMENTO ?? "").toUpperCase() === up);
    if (exactInst.length) {
      return Response.json({
        results: exactInst.slice(0, 20).map((r) => ({
          comune: r.DESCRIZIONECOMUNE,
          provincia: r.PROVINCIA,
          scuola: r.DENOMINAZIONESCUOLA,
          classe: r.CLASSE_DISPLAY,
          codiceIstituto: r.CODICEISTITUTORIFERIMENTO,
          codiceScuola: r.CODICESCUOLA,
        })),
        mode: "CODICEISTITUTORIFERIMENTO",
      });
    }
  }

  // fallback ranking
  const ranked = rows
    .map((r) => ({ r, s: score(q, r) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 10)
    .map(({ r, s }) => ({
      score: s,
      comune: r.DESCRIZIONECOMUNE,
      provincia: r.PROVINCIA,
      scuola: r.DENOMINAZIONESCUOLA,
      classe: r.CLASSE_DISPLAY,
      codiceIstituto: r.CODICEISTITUTORIFERIMENTO,
      codiceScuola: r.CODICESCUOLA,
    }));

  return Response.json({ results: ranked, mode: "RANKED" });
}
