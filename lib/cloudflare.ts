const PHASE = "http_request_dynamic_redirect";

type Rule = {
  id: string;
  expression: string;
  description?: string;
  action_parameters?: {
    from_value?: {
      status_code?: number;
      target_url?: { value?: string; expression?: string };
      preserve_query_string?: boolean;
    };
  };
};

function config() {
  const { CLOUDFLARE_API_TOKEN, CLOUDFLARE_ZONE_ID, CLOUDFLARE_RULE_ID } = process.env;
  if (!CLOUDFLARE_API_TOKEN || !CLOUDFLARE_ZONE_ID) {
    throw new Error("Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID in .env.local");
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
    requestUrl: rule.expression.match(/"([^"]+)"/)?.[1] ?? rule.expression,
    targetUrl: from?.target_url?.value ?? "",
    statusCode: from?.status_code ?? 302,
  };
}

export async function setRedirect(targetUrl: string) {
  const { zone } = config();
  const { rulesetId, rule } = await findRule();

  await api(`/zones/${zone}/rulesets/${rulesetId}/rules/${rule.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      action_parameters: {
        from_value: {
          ...rule.action_parameters?.from_value,
          target_url: { value: targetUrl },
        },
      },
    }),
  });

  return getRedirect();
}
