"use client";

import dynamic from "next/dynamic";
import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { FrameProvider } from "~/components/providers/FrameProvider";
import { RefreshProvider } from "~/components/providers/RefreshProvider";

const WagmiProvider = dynamic(
  () => import("~/components/providers/WagmiProvider"),
  {
    ssr: false,
  }
);

export function Providers({
  session,
  children,
}: {
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <WagmiProvider>
        <FrameProvider>
          <RefreshProvider>{children}</RefreshProvider>
        </FrameProvider>
      </WagmiProvider>
    </SessionProvider>
  );
}
