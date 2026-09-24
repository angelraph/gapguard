"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { PROTECTION_MARKETS, type NetworkId } from "@/lib/meteora/dbcPool";

/**
 * Gap Insurance runs on two networks at once: mainnet (real money) and
 * devnet (a free test network with a free faucet). This holds which one the
 * visitor has chosen, and everything that differs between them.
 *
 * A website cannot change the network inside someone's wallet, so the
 * wallet has to be set to match. The page tells people that plainly.
 */

export type NetworkConfig = {
  id: NetworkId;
  label: string;
  isDevnet: boolean;
  rpc: string;
  pool: string | undefined;
  market: (typeof PROTECTION_MARKETS)[NetworkId];
};

// Referenced as plain property accesses so Next inlines them at build time.
const MAINNET_POOL = process.env.NEXT_PUBLIC_PROTECTION_POOL_MAINNET;
const DEVNET_POOL = process.env.NEXT_PUBLIC_PROTECTION_POOL_DEVNET;
const MAINNET_RPC =
  process.env.NEXT_PUBLIC_MAINNET_RPC_URL ?? "https://api.mainnet-beta.solana.com";
const DEVNET_RPC = "https://api.devnet.solana.com";

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    label: "Mainnet (real money)",
    isDevnet: false,
    rpc: MAINNET_RPC,
    pool: MAINNET_POOL,
    market: PROTECTION_MARKETS.mainnet,
  },
  devnet: {
    id: "devnet",
    label: "Devnet (free test)",
    isDevnet: true,
    rpc: DEVNET_RPC,
    pool: DEVNET_POOL,
    market: PROTECTION_MARKETS.devnet,
  },
};

const DEFAULT_NETWORK: NetworkId = MAINNET_POOL ? "mainnet" : "devnet";
const STORAGE_KEY = "gapguard-network";

type NetworkContextValue = {
  config: NetworkConfig;
  setNetwork: (id: NetworkId) => void;
};

const NetworkContext = createContext<NetworkContextValue>({
  config: NETWORKS[DEFAULT_NETWORK],
  setNetwork: () => {},
});

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [id, setId] = useState<NetworkId>(DEFAULT_NETWORK);

  // Read the saved or requested choice after mount, so server and first
  // client render agree.
  useEffect(() => {
    try {
      const fromUrl = new URLSearchParams(window.location.search).get("network");
      const saved = window.localStorage.getItem(STORAGE_KEY);
      const wanted = fromUrl ?? saved;
      if (wanted === "mainnet" || wanted === "devnet") setId(wanted);
    } catch {
      // Storage can be blocked; the default is fine.
    }
  }, []);

  function setNetwork(next: NetworkId) {
    setId(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not saving the choice is harmless.
    }
  }

  return (
    <NetworkContext.Provider value={{ config: NETWORKS[id], setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
