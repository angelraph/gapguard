const { Keypair } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");
const file = path.join(__dirname, "treasury.json");
if (fs.existsSync(file)) { console.log("exists already:", Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(file)))).publicKey.toBase58()); process.exit(0); }
const kp = Keypair.generate();
fs.writeFileSync(file, JSON.stringify(Array.from(kp.secretKey)));
console.log("created:", kp.publicKey.toBase58());
