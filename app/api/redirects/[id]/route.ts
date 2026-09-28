import { NextResponse } from "next/server";
import { deleteRedirect, updateRedirect } from "@/lib/cloudflare";
import { normalizePath, normalizeUrl } from "@/lib/url";
import { failure } from "../route";

export async function PUT(request: Request, ctx: RouteContext<"/api/redirects/[id]">) {
  const { id } = await ctx.params;
  const { path, targetUrl } = await request.json();

  let clean;
  try {
    clean = { path: normalizePath(String(path ?? "")), targetUrl: normalizeUrl(String(targetUrl ?? "")) };
  } catch (error) {
    return failure(error, 400);
  }

  try {
    return NextResponse.json(await updateRedirect(id, clean.path, clean.targetUrl));
  } catch (error) {
    return failure(error, 500);
  }
}

export async function DELETE(_request: Request, ctx: RouteContext<"/api/redirects/[id]">) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await deleteRedirect(id));
  } catch (error) {
    return failure(error, 500);
  }
}
