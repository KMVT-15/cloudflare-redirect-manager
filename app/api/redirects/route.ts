import { NextResponse } from "next/server";
import { createRedirect, listRedirects } from "@/lib/cloudflare";
import { normalizePath, normalizeUrl } from "@/lib/url";

export function failure(error: unknown, status: number) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Something went wrong" },
    { status },
  );
}

export async function GET() {
  try {
    return NextResponse.json(await listRedirects());
  } catch (error) {
    return failure(error, 500);
  }
}

export async function POST(request: Request) {
  const { path, targetUrl } = await request.json();

  let clean;
  try {
    clean = { path: normalizePath(String(path ?? "")), targetUrl: normalizeUrl(String(targetUrl ?? "")) };
  } catch (error) {
    return failure(error, 400);
  }

  try {
    return NextResponse.json(await createRedirect(clean.path, clean.targetUrl));
  } catch (error) {
    return failure(error, 500);
  }
}
