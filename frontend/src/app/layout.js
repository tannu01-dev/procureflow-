
import "./globals.css";

export const metadata = {
  title: "ProcureFlow | Procurement Management",
  description:
    "Manage purchasing, supplier relationships, approvals and payments with ProcureFlow.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
