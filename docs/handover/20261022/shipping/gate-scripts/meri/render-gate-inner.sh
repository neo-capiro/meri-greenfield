apt-get update -qq >/dev/null 2>&1
apt-get install -y -qq python3-pip python-is-python3 >/dev/null 2>&1
pip install -q --break-system-packages 'cryptography>=42' >/dev/null 2>&1
python --version; python -c 'import cryptography;print("cryptography",cryptography.__version__)'
for m in infra/product-preview/first-chat-observability.test.mjs infra/product-preview/first-chat/render-features.test.mjs infra/product-preview/first-chat/runtime-values.test.mjs infra/product-preview/first-chat/render-material.test.mjs infra/product-preview/temporal-deployment.test.mjs; do
  echo "=== $m"; node --test --test-concurrency=1 $m 2>&1; echo "exit $?"
done
