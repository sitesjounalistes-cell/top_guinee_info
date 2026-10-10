import type { Metadata } from "next";
import { Playfair_Display, Inter, Lora, Merriweather, Roboto_Slab, Oswald, Montserrat, Poppins, Space_Grotesk, Bebas_Neue } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

/* Typographie éditoriale premium :
   — Playfair Display : titres de presse (didone à fort contraste)
   — Inter : interface et textes courants
   — Catalogue étendu (choisissable dans l'éditeur sur titres, chapeaux
     et corps) : chaque famille n'est téléchargée par le visiteur QUE
     si elle est réellement utilisée dans un contenu publié */
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

const lora = Lora({ subsets: ["latin"], variable: "--font-lora", display: "swap" });
const merriweather = Merriweather({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-merriweather", display: "swap" });
const robotoSlab = Roboto_Slab({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-roboto-slab", display: "swap" });
const oswald = Oswald({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-oswald", display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-montserrat", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-grotesk", display: "swap" });
const bebasNeue = Bebas_Neue({ subsets: ["latin"], weight: "400", variable: "--font-bebas", display: "swap" });

export const metadata: Metadata = {
  // Base de résolution des URLs relatives (og:image du layout racine).
  // Le domaine définitif topguinee.info remplacera cette valeur dès qu'il
  // sera déployé — les pages article construisent leurs propres URLs
  // absolues depuis l'origine réellement servie (cf. article/[slug]).
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://topguineeinfo.vercel.app"),
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
    <html lang="fr" suppressHydrationWarning className={`${playfair.variable} ${inter.variable} ${lora.variable} ${merriweather.variable} ${robotoSlab.variable} ${oswald.variable} ${montserrat.variable} ${poppins.variable} ${spaceGrotesk.variable} ${bebasNeue.variable}`}>
      <body className="antialiased bg-background text-foreground font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
