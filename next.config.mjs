import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  experimental: {
    serverComponentsExternalPackages: ["pdfjs-dist"],
    // pdfjs loads its worker file with a dynamic require that Vercel's file tracing cannot see,
    // so include it explicitly for the upload route (otherwise PDF parsing fails in production).
    outputFileTracingIncludes: {
      "/api/products/parse": ["./node_modules/pdfjs-dist/legacy/build/**"],
    },
  },
  webpack(config) {
    // Explicit "@" alias (mirrors tsconfig paths) so server-side imports resolve reliably.
    config.resolve.alias["@"] = root;
    return config;
  },
};
