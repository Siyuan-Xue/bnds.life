import "~/styles/globals.css";

import { type Metadata } from "next";
import { Shell } from "~/components/shell";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "BNDS.life · 十一小日子",
  description: "在十一小日子，重看那些普通而珍贵的校园时光。",
  icons: [
    { rel: "icon", type: "image/png", url: "/brand/logo-transparent.png" },
    {
      rel: "icon",
      type: "image/png",
      url: "/brand/logo-dark.png",
      media: "(prefers-color-scheme: dark)",
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <TRPCReactProvider>
          <Shell>{children}</Shell>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
