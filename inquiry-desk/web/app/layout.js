import "./globals.css";

export const metadata = {
  title: "Inquiry Desk",
  description: "Customer inquiries, kept in order.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
