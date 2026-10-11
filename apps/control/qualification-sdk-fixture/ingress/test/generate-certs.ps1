param(
  [string]$OutputDirectory = '',
  [string]$OpenSsl = 'C:\Program Files\Git\mingw64\bin\openssl.exe'
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $OpenSsl -PathType Leaf)) { throw "OpenSSL executable missing: $OpenSsl" }
if ($OutputDirectory -eq '') {
  $OutputDirectory = Join-Path $PSScriptRoot '../../../../../.task-inputs/sdk-fixture-ingress-1/certs'
}
$certDir = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $certDir -Force | Out-Null
$owned = @('ca1.crt','ca1.key','ca2.crt','ca2.key','server.crt','server.key',
  'client-trusted.crt','client-trusted.key','client-trusted-b.crt','client-trusted-b.key',
  'client-untrusted.crt','client-untrusted.key')
foreach ($name in $owned) {
  if (Test-Path -LiteralPath (Join-Path $certDir $name)) {
    throw "Refusing to overwrite existing synthetic certificate: $name"
  }
}

function Invoke-OpenSsl([string[]]$Arguments) {
  & $OpenSsl @Arguments 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "OpenSSL exited $LASTEXITCODE for $($Arguments[0])" }
}

$serverExt = Join-Path $certDir 'server.ext'
$clientExt = Join-Path $certDir 'client.ext'
Set-Content -LiteralPath $serverExt -Encoding ascii -Value @(
  'basicConstraints=critical,CA:FALSE',
  'keyUsage=critical,digitalSignature,keyEncipherment',
  'extendedKeyUsage=serverAuth',
  'subjectAltName=IP:127.0.0.1,DNS:localhost',
  'subjectKeyIdentifier=hash'
)
Set-Content -LiteralPath $clientExt -Encoding ascii -Value @(
  'basicConstraints=critical,CA:FALSE',
  'keyUsage=critical,digitalSignature',
  'extendedKeyUsage=clientAuth',
  'subjectKeyIdentifier=hash'
)

foreach ($ca in @('ca1','ca2')) {
  Invoke-OpenSsl @('req','-x509','-newkey','rsa:2048','-nodes','-days','30',
    '-subj',"/CN=ingress-test-$ca",'-keyout',(Join-Path $certDir "$ca.key"),
    '-out',(Join-Path $certDir "$ca.crt"))
}
foreach ($entry in @(
  @{ Name='server'; Subject='/CN=localhost'; Ca='ca1'; Ext=$serverExt },
  @{ Name='client-trusted'; Subject='/CN=fixture-worker-a'; Ca='ca1'; Ext=$clientExt },
  @{ Name='client-trusted-b'; Subject='/CN=fixture-worker-b'; Ca='ca1'; Ext=$clientExt },
  @{ Name='client-untrusted'; Subject='/CN=fixture-worker-b'; Ca='ca2'; Ext=$clientExt }
)) {
  $name = $entry.Name
  Invoke-OpenSsl @('req','-newkey','rsa:2048','-nodes','-subj',$entry.Subject,
    '-keyout',(Join-Path $certDir "$name.key"),'-out',(Join-Path $certDir "$name.csr"))
  Invoke-OpenSsl @('x509','-req','-days','30','-in',(Join-Path $certDir "$name.csr"),
    '-CA',(Join-Path $certDir "$($entry.Ca).crt"),
    '-CAkey',(Join-Path $certDir "$($entry.Ca).key"),'-CAcreateserial',
    '-extfile',$entry.Ext,'-out',(Join-Path $certDir "$name.crt"))
}
Write-Output "Generated synthetic loopback certificates in $certDir"
