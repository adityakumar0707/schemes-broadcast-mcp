"use client";
import { useRef, useState } from "react";
import { importProducts } from "@/app/dashboard/actions";

type Row = { name: string; price: number | null; unit: string | null };

export default function ProductUploadModal() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function close() { setOpen(false); setRows(null); setError(""); setInfo(""); if (fileRef.current) fileRef.current.value = ""; }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(""); setRows(null); setInfo("");
    const fd = new FormData(); fd.append("file", file);
    try {
      const r = await fetch("/api/products/parse", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Could not read the file"); return; }
      setRows(j.rows);
      if (j.total > j.limit) setInfo(`Found ${j.total} products. Only the first ${j.limit} will be added per upload.`);
    } catch { setError("Upload failed. Try again."); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>Upload catalogue (PDF / CSV)</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Upload your product list</h2>
              <button type="button" onClick={close} className="text-gray-500 hover:text-gray-800" aria-label="Close">✕</button>
            </div>
            <p className="mt-2 text-sm text-gray-600">Upload a PDF, CSV or TXT with one product per line as <code className="rounded bg-gray-100 px-1">Product | Price | Unit</code>. Up to 10 products are added per upload, and a picture is looked up for each automatically.</p>
            <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 p-3 text-sm">
              Just testing? <a className="font-medium text-emerald-700 underline" href="/sample-catalogue.pdf" download>Download the sample PDF</a>, then upload it here.
            </p>
            <input ref={fileRef} type="file" accept=".pdf,.csv,.txt,application/pdf,text/csv,text/plain" onChange={onFile} className="mt-4 block w-full text-sm" />
            {busy && <p className="mt-3 text-sm text-gray-500">Reading file…</p>}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            {info && <p className="mt-3 text-sm text-amber-700">{info}</p>}
            {rows && (
              <form action={importProducts} className="mt-4">
                <p className="mb-1 text-sm font-medium">Preview ({rows.length} products)</p>
                <div className="overflow-hidden rounded border">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs text-gray-500"><tr><th className="p-2">Name</th><th>Price ₹</th><th>Unit</th></tr></thead>
                    <tbody>{rows.map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.name}</td><td>{r.price ?? "-"}</td><td>{r.unit ?? "-"}</td></tr>)}</tbody>
                  </table>
                </div>
                <input type="hidden" name="rows" value={JSON.stringify(rows)} />
                <div className="mt-4 flex gap-2">
                  <button className="btn">Add {rows.length} products</button>
                  <button type="button" className="btn-secondary" onClick={close}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
