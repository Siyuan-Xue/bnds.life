import "~/styles/globals.css";

import { type Metadata } from "next";
import { Shell } from "~/components/shell";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "BNDS.life · 十一小日子",
  description: "在十一小日子，重看那些普通而珍贵的校园时光。",
  icons: [
    {
      rel: "icon",
      type: "image/x-icon",
      sizes: "16x16 32x32 48x48 64x64 128x128 256x256",
      url: "/favicon.ico?v=2",
    },
    { rel: "icon", type: "image/svg+xml", sizes: "any", url: "/icon.svg?v=2" },
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
