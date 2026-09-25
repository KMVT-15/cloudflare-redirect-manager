const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;

export const DEFAULT_TARGET = "https://www.youtube.com/@KMVT15/streams";

export function normalizeUrl(input: string) {
  const cleaned = input.trim().replace(/^[<"']+|[>"']+$/g, "").trim();
  if (!cleaned) throw new Error("Enter a web address");

  const scheme = cleaned.match(SCHEME)?.[1].toLowerCase();
  if (scheme && scheme !== "http" && scheme !== "https") {
    throw new Error(`Addresses have to start with http:// or https://, not ${scheme}://`);
  }

  let url;
  try {
    url = new URL(scheme ? cleaned : `https://${cleaned.replace(/^\/+/, "")}`);
  } catch {
    throw new Error(`"${cleaned}" doesn't look like a web address`);
  }

  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("Addresses have to start with http:// or https://");
  }
  if (!url.hostname.includes(".")) {
    throw new Error(`"${url.hostname}" isn't a complete domain name`);
  }

  const bareDomain = url.pathname === "/" && !url.search && !url.hash;
  return bareDomain ? `${url.protocol}//${url.host}` : url.href;
}
