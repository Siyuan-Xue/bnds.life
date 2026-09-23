import "~/styles/globals.css";

import { type Metadata } from "next";
import { Shell } from "~/components/shell";

import { TRPCReactProvider } from "~/trpc/react";

const initializeTheme = `(() => {
  try {
    const saved = localStorage.getItem("bnds:theme");
    document.documentElement.dataset.theme = saved === "light" || saved === "dark"
      ? saved
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } catch {
    document.documentElement.dataset.theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
})()`;

export const metadata: Metadata = {
  title: "BNDS.life",
  description: "在十一小日子，重看那些普通而珍贵的校园时光。",
  icons: [
    {
      rel: "icon",
      type: "image/x-icon",
      sizes: "16x16 32x32 48x48 64x64 128x128 256x256",
      url: "/favicon.ico?v=5",
    },
    {
      rel: "icon",
      type: "image/x-icon",
      sizes: "16x16 32x32 48x48 64x64 128x128 256x256",
      url: "/brand/favicon-dark.ico?v=5",
      media: "(prefers-color-scheme: dark)",
    },
    { rel: "icon", type: "image/svg+xml", sizes: "any", url: "/icon.svg?v=5" },
    {
      rel: "icon",
      type: "image/svg+xml",
      sizes: "any",
      url: "/brand/favicon-dark.svg?v=5",
      media: "(prefers-color-scheme: dark)",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: initializeTheme }} />
      </head>
      <body>
        <TRPCReactProvider>
          <Shell>{children}</Shell>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
