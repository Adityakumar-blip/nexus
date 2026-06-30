import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import {
  APP_COLOR_THEME_STORAGE_KEY,
  DEFAULT_COLOR_THEME,
} from "@/lib/appearance";

export const metadata: Metadata = {
  title: "Nexus — Projects & Knowledge",
  description:
    "A simple, useful workspace that keeps your projects, tasks, and knowledge in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appearanceBootScript = `
    try {
      var theme = localStorage.getItem(${JSON.stringify(APP_COLOR_THEME_STORAGE_KEY)}) || ${JSON.stringify(DEFAULT_COLOR_THEME)};
      document.documentElement.dataset.colorTheme = theme;
    } catch (_) {
      document.documentElement.dataset.colorTheme = ${JSON.stringify(DEFAULT_COLOR_THEME)};
    }
  `;

  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} />
      </head>
      <body className="bg-background text-foreground min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
