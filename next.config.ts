import type { NextConfig } from "next";

// ─── En-têtes de sécurité ─────────────────────────────────────────
// Appliqués à toutes les réponses servies par Next.js. La CSP reste
// volontairement permissive sur les scripts inline (l'application est
// une SPA sans gestion de nonce) mais bloque object/embed/base, limite
// les frames aux lecteurs vidéo autorisés et les connexions externes.
// La protection XSS de fond repose sur la sanitisation par liste
// blanche (src/lib/sanitize.ts), en serveur et au rendu.
const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Images et médias : CDN Cloudinary, proxys Drive, données de
      // replacement des lecteurs — jamais de script ni de frame depuis data:
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      // Lecteurs vidéo intégrés (TV & vidéos d'articles) — YouTube/Facebook uniquement
      "frame-src https://www.youtube.com https://www.youtube-nocookie.com https://www.facebook.com https://www.facebook.net",
      // Next inline styles + éditeur riche : styles inline requis
      "style-src 'self' 'unsafe-inline'",
      // SPA sans nonce : scripts bundles + bootstrap inline de Next
      "script-src 'self' 'unsafe-inline'",
      // Appels API du site + flux audio proxifiés
      "connect-src 'self' https:",
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // Uniquement efficace une fois le site servi en HTTPS — sans risque sinon
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    // Les erreurs de type bloquent à nouveau le build (elles étaient
    // ignorées : régressions invisibles possibles).
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
