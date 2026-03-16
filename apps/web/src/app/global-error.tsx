"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{ padding: "40px", fontFamily: "sans-serif", textAlign: "center" }}>
          <h2 style={{ fontSize: "24px", marginBottom: "16px" }}>Something went wrong</h2>
          <p style={{ color: "#666", marginBottom: "16px" }}>{error.message}</p>
          <button
            onClick={reset}
            style={{
              padding: "12px 24px",
              backgroundColor: "#2563eb",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
