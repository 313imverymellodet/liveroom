/** Liveroom brand constants — one place to change names and links.
 *
 * Liveroom is a fork of Producer by Boomin (AGPL-3.0). See NOTICE.md. */
export const PRODUCT_NAME = "Liveroom";
export const WORDMARK = "LIVEROOM";
export const UPSTREAM_REPO_URL = "https://github.com/Boomin-Ai/producer";
export const REPO_URL = "https://github.com/313imverymellodet/liveroom";
/** owner/name of REPO_URL, for the GitHub API (release notes in Settings). */
export const REPO_SLUG = REPO_URL.replace("https://github.com/", "");
export const SELF_HOSTING_GUIDE_URL = `${REPO_URL}/blob/main/server/SELF_HOSTING.md`;
export const SERVER_NAME = "liveroom-server";

/** Auto-update is off until Liveroom publishes its own signed release feed.
 * To turn it on: generate a key with `tauri signer generate`, put the public
 * key and your latest.json URL under plugins.updater in
 * src-tauri/tauri.conf.json, then set this to true. */
export const UPDATES_ENABLED = false;
