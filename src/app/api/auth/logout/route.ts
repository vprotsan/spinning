import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST(request: Request) {
  await destroySession();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return NextResponse.redirect(`${appUrl}/`, { status: 303 });
}
