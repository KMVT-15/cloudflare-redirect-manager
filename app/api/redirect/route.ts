import { NextResponse } from "next/server";
import { getRedirect, setRedirect } from "@/lib/cloudflare";
import { normalizeUrl } from "@/lib/url";

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong";
}

export async function GET() {
  try {
    return NextResponse.json(await getRedirect());
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const { targetUrl } = await request.json();

  let normalized;
  try {
    normalized = normalizeUrl(String(targetUrl ?? ""));
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 400 });
  }

  try {
    return NextResponse.json(await setRedirect(normalized));
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}
