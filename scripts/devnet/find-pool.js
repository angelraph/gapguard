const { DynamicBondingCurveClient } = require("@meteora-ag/dynamic-bonding-curve-sdk");
const { Connection, PublicKey } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const DEVNET_RPC = "https://api.devnet.solana.com";

async function main() {
  const { config } = JSON.parse(
    fs.readFileSync(path.join(__dirname, "pool.json"), "utf-8")
  );
  const connection = new Connection(DEVNET_RPC, "confirmed");
  const client = DynamicBondingCurveClient.create(connection, "confirmed");

  const pools = await client.state.getPoolsByConfig(new PublicKey(config));
  console.log(`Found ${pools.length} pool(s) for config ${config}`);
  for (const p of pools) {
    console.log("Pool address:", p.publicKey.toBase58());
  }

  if (pools.length > 0) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "pool.json"), "utf-8"));
    data.pool = pools[0].publicKey.toBase58();
    fs.writeFileSync(path.join(__dirname, "pool.json"), JSON.stringify(data, null, 2));
    console.log("Saved pool address to pool.json");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
