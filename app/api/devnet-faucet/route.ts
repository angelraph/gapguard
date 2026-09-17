import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";

/**
 * POST /api/devnet-faucet
 *
 * Self-serve devnet test USDC, so anyone testing Gap Insurance can get
 * some without asking the project owner to send it manually — that
 * doesn't scale past one or two people. Only does anything when
 * NEXT_PUBLIC_NETWORK=devnet; on mainnet this route always fails closed.
 *
 * The treasury is the mint authority for this test token (see
 * scripts/devnet/create-mock-usdc.js), so this mints new supply directly
 * to the requester rather than transferring from a fixed balance — it
 * doesn't run out. The treasury's own devnet SOL (for fees/rent) can run
 * low eventually; that's a "top up the treasury" problem, not a design
 * flaw, and devnet SOL is free to get.
 */

const FAUCET_AMOUNT_USDC = 50;

export async function POST(req: Request) {
  if (process.env.NEXT_PUBLIC_NETWORK !== "devnet") {
    return NextResponse.json(
      { error: "This faucet only works when the site is running on devnet." },
      { status: 400 }
    );
  }

  // Deliberately a separate var from SOLANA_RPC_URL — that one stays
  // mainnet (Radar and Portfolio need it), and reusing it here would send
  // this mint transaction to the wrong network entirely.
  const rpcUrl = process.env.DEVNET_RPC_URL;
  const treasurySecret = process.env.TREASURY_KEYPAIR_SECRET;
  const mockUsdcMint = process.env.DEVNET_MOCK_USDC_MINT;

  if (!rpcUrl || !treasurySecret || !mockUsdcMint) {
    return NextResponse.json(
      { error: "Faucet isn't configured on the server yet." },
      { status: 500 }
    );
  }

  let wallet: PublicKey;
  try {
    const body = await req.json();
    wallet = new PublicKey(body.wallet);
  } catch {
    return NextResponse.json(
      { error: "That doesn't look like a valid wallet address." },
      { status: 400 }
    );
  }

  try {
    const connection = new Connection(rpcUrl, "confirmed");
    const treasury = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(treasurySecret))
    );
    const mint = new PublicKey(mockUsdcMint);

    const recipientAta = await getOrCreateAssociatedTokenAccount(
      connection,
      treasury,
      mint,
      wallet
    );

    const amount = FAUCET_AMOUNT_USDC * 10 ** 6;
    const signature = await mintTo(
      connection,
      treasury,
      mint,
      recipientAta.address,
      treasury,
      amount
    );

    return NextResponse.json({ signature, amount: FAUCET_AMOUNT_USDC });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Devnet faucet failed:", message);
    return NextResponse.json(
      { error: "Couldn't send test USDC right now. Try again in a moment." },
      { status: 502 }
    );
  }
}
