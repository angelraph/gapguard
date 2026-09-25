"use client";

/** Last line of defence: if even the page shell fails, show a plain,
 * self-contained message instead of a blank screen. It has to bring its own
 * <html> and <body> because it replaces the whole layout. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#08080b",
          color: "#f1f2f5",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <h1 style={{ fontSize: 28, margin: 0 }}>GapGuard hit a snag</h1>
        <p style={{ color: "#a3a8b5", maxWidth: 420, margin: 0 }}>
          Nothing was sent or spent. Trying again usually fixes it.
        </p>
        <button
          onClick={reset}
          style={{
            background: "#b8f56b",
            color: "#10160a",
            border: 0,
            borderRadius: 100,
            padding: "12px 24px",
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
