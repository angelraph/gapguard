import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `@kamino-finance/klend-sdk` pulls in `@orca-so/whirlpools-core`, which
   * ships a native WASM binding. Next's build-time file tracer mishandled
   * the `.wasm` asset's path on Windows (resolved to a bogus `C:\ROOT\...`
   * instead of the real node_modules path) when it tried to bundle/trace
   * that package. Marking ONLY `@orca-so/whirlpools-core` as external tells
   * Next to `require()` it directly from node_modules instead of tracing
   * it — the standard fix for native/WASM node_modules in Next.js server
   * code.
   *
   * Do NOT also externalize `@kamino-finance/klend-sdk` itself — that was
   * tried first and broke production on Vercel: with klend-sdk external,
   * Next's bundler never touches its dependency tree, so a transitive dep
   * (`rpc-websockets` -> `uuid`, which ships as an ES Module) hits Node's
   * CommonJS `require()` directly and crashes with ERR_REQUIRE_ESM. Letting
   * Next bundle klend-sdk normally (while only whirlpools-core stays
   * external) lets its bundler handle that ESM/CJS interop, since the
   * external marking is still respected recursively for the one nested
   * import that actually needs it.
   */
  serverExternalPackages: ["@orca-so/whirlpools-core"],
};

export default nextConfig;
