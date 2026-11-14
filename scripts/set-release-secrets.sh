#!/bin/bash
# Upload Liveroom's release-signing secrets to GitHub Actions.
#
# Run it yourself in a terminal; it asks for passwords with hidden input and
# sends every value straight to `gh secret set`, so nothing is printed or
# saved in shell history.
#
# Before running, put these in ~/.liveroom (or pass other paths via env):
#   developer-id.p12          Keychain Access → My Certificates → right-click
#                             "Developer ID Application: …" → Export… (.p12,
#                             set a password)
#   liveroom.provisionprofile Developer ID provisioning profile for
#                             app.liveroom.studio with System Extension
#   updater.key, updater-key-password.txt   (made by `tauri signer generate`)
#
# Usage: scripts/set-release-secrets.sh [owner/repo]
set -euo pipefail

REPO="${1:-313imverymellodet/liveroom}"
DIR="${LIVEROOM_SECRETS_DIR:-$HOME/.liveroom}"
P12="${P12:-$DIR/developer-id.p12}"
PROFILE="${PROFILE:-$DIR/liveroom.provisionprofile}"
UPDATER_KEY="${UPDATER_KEY:-$DIR/updater.key}"
UPDATER_PW_FILE="${UPDATER_PW_FILE:-$DIR/updater-key-password.txt}"
APP_ID="app.liveroom.studio"

die() { echo "✘ $*" >&2; exit 1; }
ok() { echo "✓ $*"; }
put() { printf '%s' "$2" | gh secret set "$1" --repo "$REPO" >/dev/null && ok "set $1"; }

gh auth status >/dev/null 2>&1 || die "Log in first: gh auth login"
for f in "$P12" "$PROFILE" "$UPDATER_KEY" "$UPDATER_PW_FILE"; do
  [[ -f "$f" ]] || die "Missing $f (see the top of this script)"
done

# ── Signing identity and team, read from the .p12's own certificate ────────
# (Not from the keychain: it may hold Developer ID certificates of other teams.)
P12_PW_FILE="${P12_PW_FILE:-$DIR/developer-id-p12-password.txt}"
if [[ -f "$P12_PW_FILE" ]]; then
  P12_PW="$(cat "$P12_PW_FILE")"
else
  read -r -s -p "Password you set when exporting developer-id.p12: " P12_PW; echo
fi
CERT_SUBJECT="$(openssl pkcs12 -in "$P12" -passin "pass:$P12_PW" -nokeys -clcerts 2>/dev/null | openssl x509 -noout -subject 2>/dev/null)" \
  || die "That password does not open $P12"
IDENTITY="$(sed -n 's#.*CN=\(Developer ID Application: [^/]*\).*#\1#p' <<<"$CERT_SUBJECT")"
[[ -n "$IDENTITY" ]] || die "$P12 does not hold a Developer ID Application certificate"
ok "certificate password works"
TEAM="$(sed -n 's/.*(\([A-Z0-9]\{10\}\))$/\1/p' <<<"$IDENTITY")"
[[ -n "$TEAM" ]] || die "Could not read the team ID from: $IDENTITY"
ok "identity: $IDENTITY"

# ── Provisioning profile: same checks the release workflow runs ────────────
PLIST="$(mktemp)"; trap 'rm -f "$PLIST"' EXIT
security cms -D -i "$PROFILE" > "$PLIST" 2>/dev/null || die "$PROFILE is not a provisioning profile"
python3 - "$PLIST" "$TEAM" "$APP_ID" <<'PY' || exit 1
import datetime, plistlib, sys
p = plistlib.load(open(sys.argv[1], "rb")); team, app = sys.argv[2], sys.argv[3]
e = p["Entitlements"]
problems = []
if p["ExpirationDate"] <= datetime.datetime.utcnow(): problems.append("profile has expired")
if p.get("TeamIdentifier") != [team]: problems.append(f"profile is for team {p.get('TeamIdentifier')}, not {team}")
if e.get("com.apple.application-identifier") != f"{team}.{app}": problems.append(f"profile is for {e.get('com.apple.application-identifier')}, not {team}.{app}")
if e.get("com.apple.developer.system-extension.install") is not True: problems.append("System Extension capability is missing")
if problems:
    print("✘ provisioning profile: " + "; ".join(problems), file=sys.stderr); sys.exit(1)
print("✓ provisioning profile matches", f"{team}.{app}")
PY

# ── Notarization login ─────────────────────────────────────────────────────
read -r -p "Apple ID email (for notarization): " APPLE_ID
[[ "$APPLE_ID" == *@* ]] || die "That doesn't look like an email"
echo "App-specific password: make one at https://account.apple.com → Sign-In and Security → App-Specific Passwords"
read -r -s -p "App-specific password (xxxx-xxxx-xxxx-xxxx): " APPLE_PW; echo
[[ -n "$APPLE_PW" ]] || die "No app-specific password entered"

# ── Upload ─────────────────────────────────────────────────────────────────
echo "Uploading to $REPO …"
put APPLE_SIGNING_IDENTITY "$IDENTITY"
put APPLE_TEAM_ID "$TEAM"
put APPLE_CERTIFICATE "$(base64 -i "$P12" | tr -d '\n')"
put APPLE_CERTIFICATE_PASSWORD "$P12_PW"
put APPLE_PROVISIONING_PROFILE "$(base64 -i "$PROFILE" | tr -d '\n')"
put APPLE_ID "$APPLE_ID"
put APPLE_PASSWORD "$APPLE_PW"
put TAURI_SIGNING_PRIVATE_KEY "$(cat "$UPDATER_KEY")"
put TAURI_SIGNING_PRIVATE_KEY_PASSWORD "$(cat "$UPDATER_PW_FILE")"
unset P12_PW APPLE_PW
echo "Done. Check them at https://github.com/$REPO/settings/secrets/actions"
