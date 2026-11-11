declare module "pdfjs-dist/legacy/build/pdf.js" {
  export function getDocument(src: { data: Uint8Array; useSystemFonts?: boolean }): {
    promise: Promise<{
      numPages: number;
      getPage(n: number): Promise<{ getTextContent(): Promise<{ items: { str?: string; hasEOL?: boolean }[] }> }>;
    }>;
  };
}
