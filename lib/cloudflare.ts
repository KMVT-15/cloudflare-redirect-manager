const PHASE = "http_request_dynamic_redirect";
const RAW_STRING = /r(#*)"(.*?)"\1/g;
const WILDCARD_RULE = "http.request.full_uri wildcard";

type TargetUrl = { value?: string; expression?: string };

type Rule = {
  id: string;
  action: string;
  expression: string;
  enabled: boolean;
  description?: string;
  action_parameters?: {
    from_value?: {
      status_code?: number;
      target_url?: TargetUrl;
      preserve_query_string?: boolean;
    };
  };
};

export type Redirect = {
  id: string;
  path: string;
  targetUrl: string;
  statusCode: number;
};

function config() {
  const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID } = process.env;
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    throw new Error("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID in .env.local (or .env)");
  }
  return { token: CLOUDFLARE_API_TOKEN, zone: CLOUDFLARE_ZONE_ID };
}

async function api(path: string, init?: RequestInit) {
  const { token } = config();
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  const body = await response.json();
  if (!body.success) {
    throw new Error(body.errors?.map((e: { message: string }) => e.message).join(", ") || "Cloudflare request failed");
  }
  return body.result;
}

function lastLiteral(expression: string) {
  return [...expression.matchAll(RAW_STRING)].at(-1);
}

function quote(text: string) {
  const hashes = /[#"]/.test(text) ? "##" : "";
  return `r${hashes}"${text}"${hashes}`;
}

function pathOf(rule: Rule) {
  if (!rule.expression.includes(WILDCARD_RULE)) return null;
  const pattern = lastLiteral(rule.expression)?.[2];
  return pattern?.match(/^https?\*?:\/\/[^/]+(\/.+)$/)?.[1] ?? null;
}

function targetOf(target?: TargetUrl) {
  if (target?.value) return target.value;
  return target?.expression ? lastLiteral(target.expression)?.[2] ?? "" : "";
}

function ruleBody(domain: string, path: string, targetUrl: string, statusCode: number) {
  const pattern = `http*://${domain}${path}`;
  return {
    action: "redirect",
    expression: `(${WILDCARD_RULE} ${quote(pattern)})`,
    description: path.replace(/^\//, ""),
    enabled: true,
    action_parameters: {
      from_value: {
        status_code: statusCode,
        preserve_query_string: false,
        target_url: {
          expression: `wildcard_replace(http.request.full_uri, ${quote(pattern)}, ${quote(targetUrl)})`,
        },
      },
    },
  };
}

async function load() {
  const { zone } = config();
  const [{ name: domain }, ruleset] = await Promise.all([
    api(`/zones/${zone}`),
    api(`/zones/${zone}/rulesets/phases/${PHASE}/entrypoint`),
  ]);

  const rules: Rule[] = ruleset.rules ?? [];
  return { zone, domain: domain as string, rulesetId: ruleset.id as string, rules };
}

function managed(rules: Rule[]): Redirect[] {
  return rules.flatMap((rule) => {
    const path = pathOf(rule);
    if (!path) return [];
    return [
      {
        id: rule.id,
        path,
        targetUrl: targetOf(rule.action_parameters?.from_value?.target_url),
        statusCode: rule.action_parameters?.from_value?.status_code ?? 302,
      },
    ];
  });
}

function assertPathIsFree(redirects: Redirect[], path: string, exceptId?: string) {
  if (redirects.some((r) => r.path === path && r.id !== exceptId)) {
    throw new Error(`There is already a redirect for ${path}`);
  }
}

export async function listRedirects() {
  const { domain, rules } = await load();
  return { domain, redirects: managed(rules) };
}

export async function createRedirect(path: string, targetUrl: string) {
  const { zone, domain, rulesetId, rules } = await load();
  assertPathIsFree(managed(rules), path);

  await api(`/zones/${zone}/rulesets/${rulesetId}/rules`, {
    method: "POST",
    body: JSON.stringify(ruleBody(domain, path, targetUrl, 302)),
  });

  return listRedirects();
}

export async function updateRedirect(id: string, path: string, targetUrl: string) {
  const { zone, domain, rulesetId, rules } = await load();
  const existing = rules.find((rule) => rule.id === id);
  if (!existing || !pathOf(existing)) throw new Error("That redirect no longer exists");

  assertPathIsFree(managed(rules), path, id);
  const statusCode = existing.action_parameters?.from_value?.status_code ?? 302;

  await api(`/zones/${zone}/rulesets/${rulesetId}/rules/${id}`, {
    method: "PATCH",
    body: JSON.stringify(ruleBody(domain, path, targetUrl, statusCode)),
  });

  return listRedirects();
}

export async function deleteRedirect(id: string) {
  const { zone, rulesetId, rules } = await load();
  const existing = rules.find((rule) => rule.id === id);
  if (!existing || !pathOf(existing)) throw new Error("That redirect no longer exists");

  await api(`/zones/${zone}/rulesets/${rulesetId}/rules/${id}`, { method: "DELETE" });
  return listRedirects();
}
