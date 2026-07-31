import type { Metadata } from "next";
import "./globals.css";
import AuthSync from "@/components/AuthSync";

export const metadata: Metadata = {
  title: "EMERTRACK - Emergency Tracking",
  description: "Monitor and manage emergency repairs efficiently",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthSync />
        {children}
      </body>
    </html>
  );
}