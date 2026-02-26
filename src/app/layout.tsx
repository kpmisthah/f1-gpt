import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "F1 GPT — Formula 1 AI Chatbot",
  description:
    "Ask anything about Formula 1 — drivers, teams, race results, championships, and more. Powered by AI with RAG.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
