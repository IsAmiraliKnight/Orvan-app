import type { Metadata, Viewport } from "next";

import { AppShell } from "@/components/AppShell";
import { OrvanProvider } from "@/lib/store/store";
import { THEME_SCRIPT, ThemeProvider } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orvan",
  description: "Get things done. Level up. Literally.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0d0c" },
    { media: "(prefers-color-scheme: light)", color: "#f2f6f4" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <ThemeProvider>
          <OrvanProvider>
            <AppShell>{children}</AppShell>
          </OrvanProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
