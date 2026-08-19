import type { Metadata, Viewport } from "next";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import { getSession } from "@/lib/session";
import { PlaybackSdkProvider } from "@/lib/usePlaybackSdk";

export const metadata: Metadata = {
  title: "Cycling Playlist Designer",
  description: "Design indoor cycling class playlists with Spotify.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await getSession();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100">
        {session ? (
          <PlaybackSdkProvider>
            <main className="flex-1 pb-20">{children}</main>
            <BottomNav />
          </PlaybackSdkProvider>
        ) : (
          <main className="flex-1 pb-20">{children}</main>
        )}
      </body>
    </html>
  );
}
