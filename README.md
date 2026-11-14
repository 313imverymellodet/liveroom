<p align="center">
  <img src="app-icon.png" width="140" alt="Liveroom" />
</p>

# Liveroom

> Your room. Your server. Live everywhere.

Liveroom is an open-source desktop studio for creators: go live, record,
bring on guests, and post to your own channels with your own keys. It runs
against a server you deploy yourself, for $0 on Cloudflare's free tier.
Nobody else sees your data.

Liveroom is a fork of [Producer by Boomin](https://github.com/Boomin-Ai/producer),
licensed AGPL-3.0. See [NOTICE.md](NOTICE.md) for what changed.

> **Early, not production-ready.** Expect rough edges and breaking changes,
> and keep a fallback for anything you can't afford to drop.

## What it does

**Live**
- Scenes, sources, filters, transitions. Camera, screen, windows, text,
  browser sources.
- Go live to **Twitch, Kick, and YouTube at the same time** from one encode
  on your machine. No relay, no per-destination fee.
- Record locally. Output a **virtual camera** to any app that takes one.
- Read Twitch, Kick and YouTube chat inside the studio.

**Guests**
- Share a link. Guests join from any browser; their camera and mic go
  straight to your computer. Admit from the roster, drag onto a stage slot.
- Guests who have Liveroom join from Liveroom: their scene is their camera.
- Signaling passes through your server; media is peer to peer.

**Posting**
- Cross-post to Instagram, Facebook, and Threads with your own Meta app.
- Schedule posts server-side; they fire with your laptop closed.

## Your server

The `server/` directory is the whole backend: a Cloudflare Worker with D1,
R2, a cron, and one Durable Object for guest signaling.
[server/SELF_HOSTING.md](server/SELF_HOSTING.md) is the walkthrough.

```sh
cd server && npm install
npx wrangler login
npx wrangler d1 create producer && npx wrangler r2 bucket create producer-media
# paste the database_id into wrangler.toml, set PRIMARY_TOKEN and SIGNALING_SECRET
npx wrangler deploy
```

Then open Liveroom, paste the server URL and your primary token.

(Internal names such as the `producer` database, `/v1/app/producer` routes
and `producer.*` storage keys are kept from upstream so the server contract
and upstream merges stay compatible.)

## Liveroom to Liveroom

Two people with Liveroom, each on their own server, can do a show together
with nothing in the middle:

1. You open a room. Your server knows it's open.
2. You send your friend the room link.
3. Their Liveroom opens it. Their video goes directly to your machine.
4. You admit them and put them on stage.

## Honest status

- Guest media is STUN-only. Some guests behind strict NAT won't connect
  until you configure a TURN server (`ICE_SERVERS`).
- On Windows, guests need Liveroom allowed through the firewall.
- Auto-update follows this repo's GitHub releases, signed with the
  Liveroom updater key.
- Release builds are signed and notarized for Apple team `J2432VGY7S`.
  Forks building their own releases must use their own team ID.

## Develop

For native live features on macOS, use `make setup` then `make dev`. See the
[Mac build contract](docs/MACOS-BUILDS.md) for required engine components and
signing. The frontend-only loop does not verify camera permissions, room
output or virtual-camera setup.

Requires [Bun](https://bun.sh) ≥ 1.3 and [Rust](https://rustup.rs) (stable).
On Windows: Visual Studio Build Tools (MSVC) + WebView2. On macOS: Xcode
Command Line Tools. Full setup in [CONTRIBUTING.md](./CONTRIBUTING.md).

```sh
bun install
bun run tauri dev
```

### Staying in sync with upstream

```sh
git fetch upstream
git merge upstream/main
```

## License

AGPL-3.0-only. Producer © 2026 Boomin; Liveroom modifications © 2026 the
Liveroom contributors. If you run a modified Liveroom as a service, you must
offer its source to your users.
