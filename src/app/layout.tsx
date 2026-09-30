import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

/* Typographie éditoriale premium :
   — Playfair Display : titres de presse (didone à fort contraste)
   — Inter : interface et textes courants */
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://topguinee.info"),
  title: {
    default: "Topguinee.info — L'information au-delà du factuel",
    template: "%s | Topguinee.info",
  },
  description:
    "Toute l'actualité de la Guinée et du monde : politique, économie, société, sport, culture et international. Flash info en continu, podcasts et chroniques FM.",
  keywords: [
    "Guinée", "actualité", "information", "Conakry", "politique", "économie",
    "sport", "culture", "Topguinee", "flash info", "podcasts",
  ],
  authors: [{ name: "Rédaction Topguinee.info" }],
  // Favicon et apple-touch-icon : fournis par src/app/icon.png et apple-icon.png
  openGraph: {
    title: "Topguinee.info — L'information au-delà du factuel",
    description:
      "Toute l'actualité de la Guinée et du monde : politique, économie, société, sport, culture. Flash info en continu, podcasts et chroniques FM.",
    siteName: "Topguinee.info",
    type: "website",
    locale: "fr_FR",
    images: [{ url: "/brand/og.jpg", width: 1200, height: 630, alt: "Topguinee.info — L'information au-delà du factuel" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Topguinee.info — L'information au-delà du factuel",
    description:
      "Toute l'actualité de la Guinée et du monde. Flash info en continu, podcasts et chroniques FM.",
    images: ["/brand/og.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${playfair.variable} ${inter.variable}`}>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
