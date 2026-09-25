import { NextResponse } from "next/server";
import { getRedirect, setRedirect } from "@/lib/cloudflare";

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET() {
  try {
    return NextResponse.json(await getRedirect());
  } catch (error) {
    return fail(error);
  }
}

export async function PUT(request: Request) {
  const { targetUrl } = await request.json();

  if (!URL.canParse(targetUrl) || !/^https?:$/.test(new URL(targetUrl).protocol)) {
    return NextResponse.json({ error: "Enter a full URL starting with http:// or https://" }, { status: 400 });
  }

  try {
    return NextResponse.json(await setRedirect(targetUrl));
  } catch (error) {
    return fail(error);
  }
}
