// pdfjs-dist 3.x legacy build runs on Node 18+ (newer majors need Node 22).
import * as pdfjsNs from "pdfjs-dist/legacy/build/pdf.js";

// CJS interop differs between Node/tsx and the Next bundler, so accept either shape.
const pdfjs = ((pdfjsNs as unknown as { default?: typeof pdfjsNs }).default ?? pdfjsNs) as typeof pdfjsNs;

export type CatalogueRow = { name: string; price: number | null; unit: string | null };

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/** Reads a .pdf (text-based), .csv or .txt upload into plain text. No OCR, no AI. */
export async function fileToText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isPdf = file.name.toLowerCase().endsWith(".pdf") || file.type === "application/pdf";
  if (isPdf) {
    const doc = await pdfjs.getDocument({ data: buf, useSystemFonts: true }).promise;
    if (doc.numPages > 10) throw new Error("PDF has too many pages (max 10).");
    let out = "";
    for (let i = 1; i <= doc.numPages; i++) {
      const tc = await (await doc.getPage(i)).getTextContent();
      out += tc.items.map((it) => (it.str ?? "") + (it.hasEOL ? "\n" : " ")).join("") + "\n";
    }
    return out;
  }
  return new TextDecoder().decode(buf);
}

const num = (s: string) => {
  const n = parseFloat(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * Accepts rows like "Tata Salt | 22 | kg", "Tata Salt, 22, kg", tab-separated, or "Tata Salt Rs 22 kg".
 * Header rows ("Product | Price | Unit") are ignored.
 */
export function parseCatalogueText(raw: string): CatalogueRow[] {
  let text = raw.replace(/\r/g, "");
  // Remove a header row if present.
  text = text.replace(/(?:product|item|name)[^|\n,\t]*[|,\t]\s*price[^|\n,\t]*(?:[|,\t]\s*unit[^|\n,\t]*)?/i, " ");

  const rows: CatalogueRow[] = [];

  // 1) pipe format, tolerant to text extracted without newlines
  const pipe = /([^|\n]+?)\s*\|\s*(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d+)?)\s*(?:\|\s*([A-Za-z]+))?/gi;
  for (const m of text.matchAll(pipe)) {
    const name = clean(m[1]);
    if (name) rows.push({ name, price: num(m[2].replace(",", ".")), unit: m[3] ?? null });
  }
  if (rows.length) return rows;

  // 2) line based: csv / tab / "name rs 22 kg"
  for (const line of text.split("\n")) {
    const l = line.trim();
    if (!l) continue;
    const parts = l.split(/\s*[,\t]\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2 && num(parts[1]) !== null) {
      rows.push({ name: clean(parts[0]), price: num(parts[1]), unit: parts[2] ? clean(parts[2]) : null });
      continue;
    }
    const m = l.match(/^(.+?)\s+(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(?:\/|per)?\s*([A-Za-z]+)?$/i);
    if (m) rows.push({ name: clean(m[1]), price: num(m[2]), unit: m[3] ?? null });
    else if (l.length <= 100 && !/[\d]/.test(l)) rows.push({ name: clean(l), price: null, unit: null });
  }
  return rows;
}
