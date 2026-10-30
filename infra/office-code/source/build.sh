#!/usr/bin/env bash
# Full native build adapted from Collabora's docker/from-source-gh-action/build.sh.
# MPL-2.0 upstream build path; no prebuilt engine assets or mutable source checkout.
set -euo pipefail
test "$(uname -m)" = aarch64
test -z "${ENGINE_ASSETS+x}"
jobs="${BUILD_JOBS:-24}"
case "$jobs" in ''|*[!0-9]*) exit 2;; esac
test "$jobs" -ge 1 && test "$jobs" -le 24
export SOURCE_DATE_EPOCH="$(cat /build/evidence/source-date-epoch.txt)"
export TZ=UTC LANG=C.UTF-8 LC_ALL=C.UTF-8
engine=/build/online/engine
instdir=/build/instdir
mkdir -p "$instdir/opt" /build/evidence
dpkg-query -W -f='${Package}\t${Version}\t${Architecture}\n' > /build/evidence/builder-packages.tsv
node --version > /build/evidence/node-version.txt
npm --version > /build/evidence/npm-version.txt
c++ --version > /build/evidence/compiler-version.txt
cd "$engine"
./autogen.sh --with-distro=CPLinux-LOKit --disable-epm --without-package-format \
  --disable-symbols --with-parallelism="$jobs" 2>&1 | tee /build/evidence/engine-configure.log
make -j"$jobs" 2>&1 | tee /build/evidence/engine-build.log
# The patch adds its embedded-XLSX regression cases to this existing test target.
SAL_USE_VCLPLUGIN=svp make -j"$jobs" CppunitTest_chart2_export 2>&1 | tee /build/evidence/chart2-export-test.log
cp -a instdir "$instdir/opt/collaboraoffice"
chmod -R a+rX "$instdir/opt/collaboraoffice"
cd /build/online
./autogen.sh
./configure --enable-option-checking=fatal --prefix=/usr --sysconfdir=/etc --localstatedir=/var \
  --enable-silent-rules --disable-tests --with-lokit-path="$engine/include" \
  --with-lo-path=/opt/collaboraoffice --with-lo-builddir="$engine" \
  2>&1 | tee /build/evidence/online-configure.log
# The committed vendor shrinkwrap + node_shrinkpack is consumed by its existing
# npm ci --offline target. No dependency update/online npm install is performed.
make -j"$jobs" 2>&1 | tee /build/evidence/online-build.log
make DESTDIR="$instdir" install 2>&1 | tee /build/evidence/online-install.log
readelf -h "$instdir/usr/bin/coolwsd" > /build/evidence/coolwsd-elf.txt
readelf -h "$instdir/opt/collaboraoffice/program/libmergedlo.so" > /build/evidence/engine-elf.txt
grep -q 'Machine:.*AArch64' /build/evidence/coolwsd-elf.txt
grep -q 'Machine:.*AArch64' /build/evidence/engine-elf.txt
cp /build/start-collabora-online.sh "$instdir/start-collabora-online.sh"
chmod 755 "$instdir/start-collabora-online.sh"
