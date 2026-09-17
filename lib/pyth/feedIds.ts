/**
 * Pyth price feed IDs for the curated ticker list, resolved live against
 * Hermes's public metadata endpoint on 2026-09-16:
 *
 *   GET https://hermes.pyth.network/v2/price_feeds?query=<TICKER>
 *
 * That endpoint is open (no API key). The actual price data endpoint
 * (/v2/updates/price/latest) DOES require a Pyth API key as of the Aug 2026
 * Hermes upgrade — see PYTH_API_KEY in .env.local.
 *
 * Do not hand-edit these hex IDs. If a feed ever needs to change, re-resolve
 * it against the endpoint above and paste the result — feed IDs are stable
 * per symbol but are not guessable/derivable.
 *
 * Naming convention:
 *  - `equity`   -> Equity.US.<TICKER>/USD   (traditional market price, only
 *                  updates/is fresh while NYSE is open)
 *  - `xstock`   -> Crypto.<TICKER>X/USD     (on-chain xStocks token price,
 *                  updates 24/7 — this is the token most Kamino positions
 *                  and DBC pools will actually reference)
 *  - `ondo`     -> Crypto.<TICKER>ON/USD    (on-chain Ondo Global Markets
 *                  token price, when it exists for this ticker)
 */

export type FeedIdSet = {
  equity: string;
  xstock: string;
  ondo?: string;
};

export const PYTH_FEED_IDS: Record<string, FeedIdSet> = {
  AAPL: {
    equity: "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
    xstock: "978e6cc68a119ce066aa830017318563a9ed04ec3a0a6439010fc11296a58675",
    ondo: "e6734de88a83d9d2fb33072adab319004700aefd069653aba30ba9e3cac056f2",
  },
  GOOGL: {
    equity: "5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
    xstock: "b911b0329028cd0283e4259c33809d62942bd2716a58084e5f31d64c00b5424e",
    ondo: "ad79b3487bef87ff8f8ab31c0b779ad08d931fdfa5436f7e92a234bb82bff7e4",
  },
  HOOD: {
    equity: "306736a4035846ba15a3496eed57225b64cc19230a50d14f3ed20fd7219b7849",
    xstock: "dd49a9ac6df5cbfa9d8fc6371f7ae927a74d5c6763c1c01b4220d70314c647f9",
    ondo: "8d61af9bd7c39d9503d7d99b7e9e59cc7b0bd707341ecc3ed3e3eda1a411f4de",
  },
  MSTR: {
    equity: "e1e80251e5f5184f2195008382538e847fafc36f751896889dd3d1b1f6111f09",
    xstock: "53f95ba4e23ed15ea56083e2ee9a5eec48055d6f59033d4bb95f1ca2a2349c28",
    ondo: "89a131faf74b5298981e3d25bbce60a25c6f452004da31ddd3c5805cdaa9b6ab",
  },
  NVDA: {
    equity: "b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
    xstock: "4244d07890e4610f46bbde67de8f43a4bf8b569eebe904f136b469f148503b7f",
    ondo: "207ddea2a443d30b7e13a7c88a9e3f106765deb97049afc65a18cede50fffc82",
  },
  QQQ: {
    equity: "9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d",
    xstock: "178a6f73a5aede9d0d682e86b0047c9f333ed0efe5c6537ca937565219c4054d",
    // No Ondo Global Markets token for QQQ as of 2026-09-16.
  },
  SPY: {
    equity: "19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5",
    xstock: "2817b78438c769357182c04346fddaad1178c82f4048828fe0997c3c64624e14",
    // No Ondo Global Markets token for SPY as of 2026-09-16.
  },
  TSLA: {
    equity: "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
    xstock: "47a156470288850a440df3a6ce85a55917b813a19bb5b31128a33a986566a362",
    ondo: "c09ef687ed07091c047da444f1499f2da52cdc1c085104643ec565a9eb1af514",
  },
};

/** Flat list of every feed ID we need to fetch in one Hermes batch call. */
export function allFeedIds(): string[] {
  const ids: string[] = [];
  for (const set of Object.values(PYTH_FEED_IDS)) {
    ids.push(set.equity, set.xstock);
    if (set.ondo) ids.push(set.ondo);
  }
  return ids;
}
