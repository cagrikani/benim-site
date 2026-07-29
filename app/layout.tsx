import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://cagrikani.github.io/fizigecagri/"),
  title: "Fizik Atölyesi | Merak Et, Kur, Keşfet",
  description:
    "TYMM uyumlu etkileşimli fizik deneyleri ve serbest simülasyon alanları. Düzeneği kurun, ölçün ve fiziği kanıtlarla keşfedin.",
  openGraph: {
    title: "Fizik Atölyesi · Fizik ezber değil, deneyimdir.",
    description:
      "Deney setlerini kur, değişkenleri değiştir ve kendi fizik sonucuna ulaş.",
    images: [
      {
        url: "/fizik-atolyesi-hero.png",
        width: 1536,
        height: 1024,
        alt: "Fizik Atölyesi deney düzenekleri",
      },
    ],
    locale: "tr_TR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fizik Atölyesi · Merak Et, Kur, Keşfet",
    description:
      "Etkileşimli deney setleri ve serbest fizik simülasyonları.",
    images: ["/fizik-atolyesi-hero.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
