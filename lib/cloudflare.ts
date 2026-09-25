const PHASE = "http_request_dynamic_redirect";
const RAW_STRING = /r(#*)"(.*?)"\1/g;

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

function config() {
  const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_RULE_ID } = process.env;
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    throw new Error("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID in .env.local (or .env)");
  }
  return { token: CLOUDFLARE_API_TOKEN, zone: CLOUDFLARE_ZONE_ID, ruleId: CLOUDFLARE_RULE_ID };
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

function quote(url: string) {
  const hashes = /[#"]/.test(url) ? "##" : "";
  return `r${hashes}"${url}"${hashes}`;
}

function readTarget(target?: TargetUrl) {
  if (target?.value) return target.value;
  return target?.expression ? lastLiteral(target.expression)?.[2] ?? "" : "";
}

function writeTarget(target: TargetUrl | undefined, url: string): TargetUrl {
  const expression = target?.expression;
  if (!expression) return { value: url };

  const literal = lastLiteral(expression);
  if (!literal) throw new Error("Could not find the target URL inside this rule's expression");

  const end = literal.index + literal[0].length;
  return { expression: expression.slice(0, literal.index) + quote(url) + expression.slice(end) };
}

async function findRule() {
  const { zone, ruleId } = config();
  const ruleset = await api(`/zones/${zone}/rulesets/phases/${PHASE}/entrypoint`);
  const rules: Rule[] = ruleset.rules ?? [];

  const rule = ruleId
    ? rules.find((r) => r.id === ruleId)
    : rules.find((r) => r.expression.includes("/live"));

  if (!rule) throw new Error("Could not find the /live redirect rule in this zone");
  return { rulesetId: ruleset.id as string, rule };
}

export async function getRedirect() {
  const { rule } = await findRule();
  const from = rule.action_parameters?.from_value;
  return {
    ruleId: rule.id,
    requestUrl: lastLiteral(rule.expression)?.[2] ?? rule.expression,
    targetUrl: readTarget(from?.target_url),
    statusCode: from?.status_code ?? 302,
  };
}

export async function setRedirect(targetUrl: string) {
  const { zone } = config();
  const { rulesetId, rule } = await findRule();
  const from = rule.action_parameters?.from_value;

  await api(`/zones/${zone}/rulesets/${rulesetId}/rules/${rule.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      action: rule.action,
      expression: rule.expression,
      description: rule.description,
      enabled: rule.enabled,
      action_parameters: {
        from_value: { ...from, target_url: writeTarget(from?.target_url, targetUrl) },
      },
    }),
  });

  return getRedirect();
}
