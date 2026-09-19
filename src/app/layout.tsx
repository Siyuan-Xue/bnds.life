import "~/styles/globals.css";

import { type Metadata } from "next";
import { Shell } from "~/components/shell";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "bnds life · 十一小日子",
  description: "在十一小日子，重看那些普通而珍贵的校园时光。",
  icons: [{ rel: "icon", url: "/icon.svg" }],
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
