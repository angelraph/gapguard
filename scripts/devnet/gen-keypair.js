const { Keypair } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const kp = Keypair.generate();
const outPath = path.join(__dirname, "treasury.json");
fs.writeFileSync(outPath, JSON.stringify(Array.from(kp.secretKey)));
console.log("Devnet test treasury pubkey:", kp.publicKey.toBase58());
console.log("Saved to:", outPath);
