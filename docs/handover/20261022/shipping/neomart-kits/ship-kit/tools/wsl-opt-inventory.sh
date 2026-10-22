#!/usr/bin/env bash
# Lists /opt test copies (size, last change) and Docker usage inside the Ubuntu WSL distro. Read-only.
echo "running containers: $(docker ps -q | wc -l)"
cd /opt || exit 0
for d in */; do
  printf '%6s  %s  %s\n' "$(du -sh "$d" 2>/dev/null | cut -f1)" "$(stat -c %y "$d" | cut -c1-16)" "$d"
done | sort -k2,3
docker system df
