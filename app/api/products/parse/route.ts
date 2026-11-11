import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { LIMITS } from "@/lib/guardrails";
import { MAX_UPLOAD_BYTES, fileToText, parseCatalogueText } from "@/lib/parseCatalogue";

export const maxDuration = 30;

// Parses an uploaded catalogue (pdf/csv/txt) into a preview. Nothing is saved here.
export async function POST(req: Request) {
  const { data: { user } } = await supabaseServer().auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const file = (await req.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  if (file.size > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "File too large (max 2 MB)" }, { status: 400 });
  try {
    const all = parseCatalogueText(await fileToText(file));
    if (all.length === 0) return NextResponse.json({ error: "No products found. Use the sample format: Product | Price | Unit, one per line." }, { status: 422 });
    const rows = all.slice(0, LIMITS.productsPerUpload);
    return NextResponse.json({ rows, total: all.length, limit: LIMITS.productsPerUpload });
  } catch (e) {
    return NextResponse.json({ error: `Could not read this file: ${(e as Error).message}` }, { status: 422 });
  }
}
