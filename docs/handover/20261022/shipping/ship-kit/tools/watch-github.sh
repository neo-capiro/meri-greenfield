#!/usr/bin/env bash
# Polls GitHub every 2 minutes for build-agent activity and prints one line per new event (decisions O129, O137).
# Watches: issue/PR conversation comments and PR review comments in the three repos (skipping comments that start
# with "FROM: Fable"), new commits on open PRs, and PRs created after the watch started. Read-only.
# A repo whose PR listing fails keeps its previous snapshot, so a transient API error never reports old PRs as new.
REPOS="neo-capiro/meri-greenfield neo-capiro/capiro-frontend neo-capiro/capiro-backend"
STATE=/tmp/watch-github-heads
started=$(date -u +%Y-%m-%dT%H:%M:%SZ)
since=$started
list() { gh pr list --repo "$1" --state open --limit 500 --json number,headRefOid,createdAt,title \
  --jq ".[] | \"$1#\(.number) \(.headRefOid) \(.createdAt) \(.title)\""; }
mkdir -p "$STATE"
for r in $REPOS; do f="$STATE/${r//\//_}"; list "$r" > "$f.tmp" 2>/dev/null && [ -s "$f.tmp" ] && mv "$f.tmp" "$f"; done
while true; do
  sleep 120
  now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  for r in $REPOS; do
    for ep in issues/comments pulls/comments; do
      gh api "repos/$r/$ep?since=$since&per_page=100" --jq '.[] | select((.body|startswith("FROM: Fable"))|not) | "COMMENT \(.html_url): \(.body|gsub("[\r\n]+";" ")|.[0:200])"' 2>/dev/null
    done
    f="$STATE/${r//\//_}"
    list "$r" > "$f.new" 2>/dev/null && [ -s "$f.new" ] || { rm -f "$f.new"; continue; }
    while read -r key sha created title; do
      old=$(grep "^$key " "$f" 2>/dev/null | cut -d' ' -f2)
      if [ -z "$old" ]; then [[ "$created" > "$started" ]] && echo "NEW_PR $key ${sha:0:8} $title"
      elif [ "$old" != "$sha" ]; then echo "PUSH $key ${old:0:8} -> ${sha:0:8} $title"; fi
    done < "$f.new"
    mv "$f.new" "$f"
  done
  since=$now
done
