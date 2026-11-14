# Notice

Liveroom is a modified version of **Producer** by Boomin,
<https://github.com/Boomin-Ai/producer>, forked from upstream commit
`0745894` (Producer 0.4.90, November 8, 2026).

- Producer: Copyright © 2026 Boomin. Licensed under the GNU Affero General
  Public License, version 3 only (AGPL-3.0-only).
- Liveroom modifications: Copyright © 2026 the Liveroom contributors.
  Licensed under the same terms, AGPL-3.0-only. See [LICENSE](LICENSE).

Liveroom is not affiliated with or endorsed by Boomin. "Producer" and
"Boomin" are names of their respective owners and are used here only to
state where this code comes from.

## What Liveroom changed (first modified November 14, 2026)

- Renamed the product to Liveroom: app name, window titles, wordmark,
  virtual camera name, recording folders, and app identifier
  (`app.liveroom.studio`, previously `ai.boomin.producer`).
- Made the app self-hosted only. Sign-in connects to a Liveroom server you
  deploy; the Boomin hosted sign-in is no longer reachable. That code
  (`BoominLogin`, `UpstreamOnboardingChooser` in `src/views/Onboarding.tsx`)
  is kept so upstream changes merge cleanly.
- Bug reports are no longer sent to Boomin's API when no server accepts them;
  the user copies the report instead.
- Pointed auto-update at Liveroom's own release feed, signed with a new
  updater key, instead of Boomin's.
- Replaced Boomin's Apple team ID in signing files with Liveroom's.
- Restarted version numbering at 0.1.0.
- New placeholder app icon.
- Replaced the contributor license agreement with plain AGPL-3.0 terms.

Upstream history is preserved in git. Historical design notes and release
notes under `docs/` and the `labs/` and `atlantium-ios/` folders are kept as
upstream wrote them.

## Your obligations if you run Liveroom for others

AGPL-3.0 section 13: if you modify Liveroom and let people use it over a
network (for example, a hosted Liveroom server), you must offer those users
the corresponding source code of your version.
