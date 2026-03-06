import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Borna - OpenSandbox Dashboard",
  description: "Health monitoring and management dashboard for OpenSandbox",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
