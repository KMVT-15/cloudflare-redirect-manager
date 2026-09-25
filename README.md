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

## Deployment

Runs on `kmvt-automation-server` at `http://redirects.kmvt.net` (tailnet only — the
hostname resolves to the server's Tailscale address, so there is no TLS and no
public exposure).

| | |
|---|---|
| Repository | `/root/redirect-switcher` |
| Service | `redirect-switcher.service`, listening on `127.0.0.1:3001` |
| Proxy | second `server` block in `/etc/nginx/sites-available/default` |

### Redeploying

**Do not run `npm run build` on the server.** It has 2 GB of RAM, no swap, and
shares the box with Bitfocus Companion; a build there exhausts memory and takes
the whole machine down. Build here and ship the output instead:

```
npm run build
COPYFILE_DISABLE=1 tar --no-xattrs -czf - .next app lib package.json package-lock.json \
  | ssh root@kmvt-automation-server 'tar xzf - -C /root/redirect-switcher'
ssh root@kmvt-automation-server 'cd /root/redirect-switcher && npm ci --omit=dev && systemctl restart redirect-switcher'
```

`npm ci --omit=dev` installs only what `next start` needs, which is cheap enough
to run on the server. The service is capped at `MemoryMax=400M` so it cannot
starve Companion; it normally sits around 88 MB.
