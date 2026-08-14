import { NextPageContext } from "next"

/**
 * Pages Router fallback (the App Router error/not-found files cover everything
 * else). There is no `_app.tsx` in src/pages, so globals.css never loads here
 * and Tailwind classes would not resolve: the brand is hand-rolled in inline
 * styles instead, dependency-free and safe to render on the server.
 * Colours are the design tokens: ink-950 #18181b, play-600 #4f46e5.
 */
function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        backgroundColor: "#18181b",
        backgroundImage:
          "linear-gradient(150deg, #232329 0%, #18181b 55%, #0e0e10 100%)",
        fontFamily:
          "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          borderRadius: "28px",
          border: "1px solid rgba(255,255,255,0.12)",
          backgroundColor: "rgba(255,255,255,0.06)",
          padding: "32px",
          textAlign: "center",
          boxShadow: "0 24px 70px -40px rgba(0,0,0,0.9)",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 800,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.45)",
          }}
        >
          {statusCode || "Error"}
        </p>
        <h1
          style={{
            margin: "8px 0 0",
            fontSize: "24px",
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          {statusCode === 404 ? "We cannot find that page" : "This page did not load"}
        </h1>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: "14px",
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.65)",
          }}
        >
          {statusCode === 404
            ? "The link may be old, or the page moved. Everything else is still where you left it."
            : "Try it again. If it keeps happening, come back in a few minutes and we should have it fixed."}
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            marginTop: "24px",
            padding: "13px 22px",
            backgroundColor: "#4f46e5",
            color: "#ffffff",
            borderRadius: "12px",
            textDecoration: "none",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Go to the home page
        </a>
      </div>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
