import path from "path";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
export default {
  experimental: { serverComponentsExternalPackages: ["pdfjs-dist"] },
  webpack(config) {
    // Explicit "@" alias (mirrors tsconfig paths) so server-side imports resolve reliably.
    config.resolve.alias["@"] = root;
    return config;
  },
};
