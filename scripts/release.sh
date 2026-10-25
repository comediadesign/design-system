#!/usr/bin/env bash
# Release a new version and tell every app to pick it up now.
#
#   scripts/release.sh 0.3.0
#
# Checks dist/ matches the Figma export, sets the version, commits, tags v0.3.0,
# pushes, then runs each app's "Design system update" workflow (they also run
# hourly on their own, so this only saves the wait). Needs the gh CLI.
set -euo pipefail
cd "$(dirname "$0")/.."
v="${1:?usage: scripts/release.sh X.Y.Z}"
node scripts/build.mjs --check
node -e "const f='package.json',fs=require('fs'),j=JSON.parse(fs.readFileSync(f));j.version='$v';fs.writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
git add -A
git commit -m "v$v" || true
git tag "v$v"
git push origin main "v$v"

# The apps on the design system: repo and the branch its workflow file lives on.
APPS=(
  "chrisbcn/comedia-email"
  "comediadesign/comedia-deck-system"
  "comediadesign/concept-prototypes"
)
for r in "${APPS[@]}"; do
  if gh workflow run design-system-update.yml -R "$r" >/dev/null 2>&1; then echo "Updating $r"; else echo "Couldn't start the update in $r (it will run within the hour)"; fi
done
