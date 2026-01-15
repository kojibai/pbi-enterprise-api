import type { NextPageContext } from "next";
import type { ReactElement } from "react";
import Link from "next/link";

type Props = { statusCode?: number };

function ErrorPage({ statusCode }: Props): ReactElement {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 720, width: "100%" }}>
        <div style={{ fontSize: 40, fontWeight: 900 }}>Error {statusCode ?? 500}</div>
        <div style={{ marginTop: 8, opacity: 0.85 }}>
          Something went wrong.
        </div>
        <div style={{ marginTop: 16 }}>
          <Link href="/" style={{ textDecoration: "underline" }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): Props => {
  const statusCode = res?.statusCode ?? err?.statusCode ?? 500;
  return { statusCode };
};

export default ErrorPage;