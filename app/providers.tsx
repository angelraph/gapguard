"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

/**
 * Wraps the app with Solana wallet-connect support. A client component
 * because wallet-adapter reads browser extension state, which doesn't
 * exist on the server.
 *
 * Phantom and Solflare both implement the Wallet Standard, so they (and
 * any other Wallet Standard wallet a visitor has installed, including
 * Backpack) show up automatically — these two adapters are just a
 * belt-and-suspenders fallback for older wallet versions.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const endpoint =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    "https://api.mainnet-beta.solana.com";

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
