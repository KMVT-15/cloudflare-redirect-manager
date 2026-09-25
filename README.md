# Redirect Switcher

A one-page tool for changing where `kmvt15.org/live` redirects to.

It reads and updates a single Cloudflare redirect rule:

| | |
|---|---|
| Request URL | `http*://kmvt15.org/live` |
| Target URL | whatever you set in the app |
| Status code | 302 |

## Setup

Copy `.env.example` to `.env.local` and fill it in:

- `CLOUDFLARE_API_TOKEN` — a token with **Zone → Config Rules → Edit** on the kmvt15.org zone
- `CLOUDFLARE_ZONE_ID` — found on the zone's Overview page in the Cloudflare dashboard
- `CLOUDFLARE_RULE_ID` — optional; without it the app picks the redirect rule whose expression mentions `/live`

Then:

```
npm install
npm run dev
```

The app has no login, so deploy it somewhere only staff can reach.
