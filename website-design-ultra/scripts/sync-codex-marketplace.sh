#!/bin/zsh

set -euo pipefail

wdu_codex_bin="${WDU_CODEX_BIN:-/Applications/ChatGPT.app/Contents/Resources/codex}"
wdu_marketplace="${WDU_MARKETPLACE:-kay-design}"
wdu_plugin="${WDU_PLUGIN:-website-design-ultra}"

if [[ ! -x "$wdu_codex_bin" ]]; then
  wdu_codex_bin="$(command -v codex 2>/dev/null || true)"
fi

if [[ -z "$wdu_codex_bin" || ! -x "$wdu_codex_bin" ]]; then
  print -u2 "website-design-ultra sync: Codex executable not found"
  exit 1
fi

print "website-design-ultra sync: checking GitHub at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
"$wdu_codex_bin" plugin marketplace upgrade "$wdu_marketplace"
"$wdu_codex_bin" plugin add "${wdu_plugin}@${wdu_marketplace}"
print "website-design-ultra sync: ${wdu_plugin}@${wdu_marketplace} is current"
