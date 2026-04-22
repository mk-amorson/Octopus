# Octopus installer bootstrap (Windows, PowerShell).
#
# Served at https://mk-amorson.github.io/octopus/install.ps1
#
# Usage:
#   iwr -useb https://mk-amorson.github.io/octopus/install.ps1 | iex
#
# Mirror of docs/pages/install: detect arch, resolve latest tag, download the
# signed binary, verify SHA256, drop it in %LOCALAPPDATA%\Octopus\bin, add
# that to the user PATH, exec `octopus install`.

$ErrorActionPreference = 'Stop'
$Repo = 'mk-amorson/octopus'

function Die($msg) {
    Write-Host "octopus-install: $msg" -ForegroundColor Red
    exit 1
}

function Detect-Arch {
    # PROCESSOR_ARCHITECTURE is AMD64, ARM64, or x86 on modern Windows.
    switch ($env:PROCESSOR_ARCHITECTURE) {
        'AMD64' { return 'amd64' }
        'ARM64' { return 'arm64' }
        default { Die "unsupported architecture: $($env:PROCESSOR_ARCHITECTURE)" }
    }
}

function Resolve-Tag {
    if ($env:OCTOPUS_VERSION) { return $env:OCTOPUS_VERSION }
    # Follow the /releases/latest redirect to read the tag from the final URL.
    try {
        $resp = Invoke-WebRequest -UseBasicParsing -Method Head `
            -MaximumRedirection 0 `
            -Uri "https://github.com/$Repo/releases/latest"
    } catch {
        # PowerShell treats the 302 as an exception, but the response still
        # has the Location header we want.
        $resp = $_.Exception.Response
    }
    $location = $resp.Headers['Location']
    if (-not $location) { Die 'could not resolve latest release tag' }
    return ($location -split '/')[-1]
}

$arch = Detect-Arch
$tag  = Resolve-Tag
$asset = "octopus_windows_${arch}.exe"
$base  = "https://github.com/$Repo/releases/download/$tag"

$installDir = Join-Path $env:LOCALAPPDATA 'Octopus\bin'
$binPath    = Join-Path $installDir 'octopus.exe'
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

$tmp = New-Item -ItemType Directory -Force -Path (Join-Path $env:TEMP ("octopus-install-" + [guid]::NewGuid()))
try {
    Write-Host "octopus-install: downloading $tag windows/$arch"
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$asset"      -OutFile (Join-Path $tmp $asset)
    Invoke-WebRequest -UseBasicParsing -Uri "$base/checksums.txt" -OutFile (Join-Path $tmp 'checksums.txt')

    Write-Host 'octopus-install: verifying checksum'
    $line = Get-Content (Join-Path $tmp 'checksums.txt') | Where-Object { $_ -match " $([Regex]::Escape($asset))$" }
    if (-not $line) { Die "no checksum entry for $asset" }
    $want = ($line -split '\s+')[0]
    $got  = (Get-FileHash -Algorithm SHA256 (Join-Path $tmp $asset)).Hash.ToLower()
    if ($want.ToLower() -ne $got) { Die "checksum mismatch: want $want, got $got" }

    Copy-Item -Force (Join-Path $tmp $asset) $binPath
    Write-Host "octopus-install: installed to $binPath"

    # Persist PATH change at the User scope so new shells pick it up.
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (-not ($userPath -split ';' | Where-Object { $_ -eq $installDir })) {
        [Environment]::SetEnvironmentVariable('Path', "$userPath;$installDir", 'User')
        Write-Host "octopus-install: added $installDir to user PATH"
    }
    # Also update this process's PATH so the exec below finds octopus.exe.
    $env:Path = "$env:Path;$installDir"

    Write-Host ''
    Write-Host 'octopus-install: starting installer. Follow the prompts.'
    Write-Host ''
    & $binPath install
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
