"use client";

import dynamic from "next/dynamic";

/**
 * The wallet button only makes sense in the browser (it reads which wallet
 * extension you have and remembers your last one). Rendering it on the server
 * makes the server and browser HTML differ, which React reports as a
 * hydration error. So it is loaded in the browser only, with a same-looking
 * placeholder while it loads.
 */
export const WalletButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  {
    ssr: false,
    loading: () => (
      <button type="button" className="wallet-adapter-button wallet-adapter-button-trigger" disabled>
        Select Wallet
      </button>
    ),
  }
);
