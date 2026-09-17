import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `@kamino-finance/klend-sdk` pulls in `@orca-so/whirlpools-core`, which
   * ships a native WASM binding. Next's build-time file tracer mishandled
   * the `.wasm` asset's path on Windows (resolved to a bogus `C:\ROOT\...`
   * instead of the real node_modules path) when it tried to bundle/trace
   * the package for the API route. Marking it (and klend-sdk, which is the
   * only thing that imports it) as a server-external package tells Next to
   * `require()` it directly from node_modules at runtime instead of
   * bundling/tracing it — the standard fix for native/WASM node_modules in
   * Next.js server code.
   */
  serverExternalPackages: [
    "@kamino-finance/klend-sdk",
    "@orca-so/whirlpools-core",
  ],
};

export default nextConfig;
