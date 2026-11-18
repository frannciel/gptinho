import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Govnex ERP", template: "%s | Govnex" },
  description: "Gestão comercial e administrativa da Govnex Soluções Digitais.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
