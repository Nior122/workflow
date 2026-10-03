import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/components/layout/theme-provider";
import { APP_NAME, APP_URL } from "@/config/constants";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — visual workflow builder`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "FlowForge is a visual workflow builder. Drag nodes onto a canvas, wire them together, press Run, and watch data travel through the flow with live statuses and a step-by-step JSON console.",
  applicationName: APP_NAME,
  keywords: ["workflow", "automation", "n8n", "make.com", "visual builder", "react flow"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0E0E11" },
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} dark h-full`}
      suppressHydrationWarning
    >
      <head>
        {/* Sets the theme class before first paint so there is no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
