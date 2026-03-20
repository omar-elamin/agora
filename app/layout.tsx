import type { Metadata } from "next";
import NavHeader from "./components/NavHeader";

export const metadata: Metadata = {
  title: "Agora",
  description: "Benchmark any AI vendor on your data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily:
            "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, monospace",
          backgroundColor: "#0a0a0a",
          color: "#e5e5e5",
        }}
      >
        <NavHeader />
        {children}
      </body>
    </html>
  );
}
