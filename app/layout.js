import "./globals.css";

export const metadata = {
  title: "PhoneTrack ERP — Administrasi Konter",
  description: "Sistem ERP & POS Internal untuk bisnis ritel smartphone lelang. Manajemen inventori, chain of custody, dan rekonsiliasi kas.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PhoneTrack",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#171717",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
