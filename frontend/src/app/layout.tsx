import type { Metadata } from "next";
import "./globals.css";
import AppHeader from "./components/AppHeader";
import { ToastProvider } from "./components/Toast";
import { AuthProvider } from "./utils/auth";

export const metadata: Metadata = {
  title: "Mana Forge",
  description: "Create Magic: The Gathering playtest proxy sheets",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>
            <AppHeader />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
