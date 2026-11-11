// Generates public/sample-catalogue.pdf as a plain, uncompressed PDF (no dependencies).
// Run: node scripts/make-sample-pdf.mjs
import { writeFileSync } from "fs";

const rows = [
  ["Tata Salt", 22, "kg"], ["Surf Excel", 180, "kg"], ["Maggi Noodles", 14, "pack"], ["Parle G Biscuits", 10, "pack"],
  ["Colgate Toothpaste", 95, "tube"], ["Dettol Soap", 45, "piece"], ["Aashirvaad Atta", 290, "kg"],
  ["Amul Butter", 56, "pack"], ["Britannia Good Day", 30, "pack"], ["Vim Dishwash Gel", 99, "bottle"],
];

let c = "";
c += "BT /F2 20 Tf 50 780 Td (Sample Product Catalogue) Tj ET\n";
c += "BT /F1 10 Tf 0.35 g 50 755 Td (Upload this file in Products > Upload catalogue. Format: Product | Price | Unit) Tj ET 0 g\n";
c += "0.85 0.95 0.9 rg 45 707 500 26 re f 0 g\n";
c += "BT /F2 13 Tf 55 715 Td (Product | Price (Rs) | Unit) Tj ET\n";
let y = 685;
for (const [n, p, u] of rows) {
  c += `BT /F1 13 Tf 55 ${y} Td (${n} | ${p} | ${u}) Tj ET\n`;
  c += `0.8 G 0.5 w 45 ${y - 8} m 545 ${y - 8} l S 0 G\n`;
  y -= 28;
}

const objs = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>",
  `<< /Length ${c.length} >>\nstream\n${c}endstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
];
let out = "%PDF-1.4\n";
const offsets = [];
objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xref = out.length;
out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync("public/sample-catalogue.pdf", Buffer.from(out, "latin1"));
console.log("written", out.length, "bytes");
