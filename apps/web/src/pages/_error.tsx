import { NextPageContext } from "next"

function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ padding: "40px", fontFamily: "sans-serif", textAlign: "center" }}>
      <h1 style={{ fontSize: "48px", marginBottom: "16px" }}>
        {statusCode || "Error"}
      </h1>
      <p style={{ color: "#666", marginBottom: "24px" }}>
        {statusCode === 404
          ? "Page not found"
          : "An error occurred on the server"}
      </p>
      <a
        href="/dashboard"
        style={{
          padding: "12px 24px",
          backgroundColor: "#2563eb",
          color: "white",
          borderRadius: "8px",
          textDecoration: "none",
          fontSize: "16px",
        }}
      >
        Go to Dashboard
      </a>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
