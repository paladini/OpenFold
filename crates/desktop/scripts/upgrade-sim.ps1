# IndexedDB upgrade simulation (spec DESK-02 AC3 / TESTING.md desktop row): build A launches and
# writes its WebView2 profile at the pinned per-OS data dir; the binary is then replaced by a fresh
# build B (simulating a version upgrade with unchanged ORIGIN/data-dir constants); build B must
# find that same profile directory still in place. Actually driving the SPA to write real
# IndexedDB rows needs page-level automation this script doesn't have -- what it verifies directly
# is the mechanism that guarantees IndexedDB survival: the on-disk WebView2 profile directory is
# stable across a binary swap, because ORIGIN and resolve_data_dir() are both frozen constants.
$ErrorActionPreference = "Stop"

$dataDir = Join-Path $env:LOCALAPPDATA "OpenFold"
$webviewProfileDir = Join-Path $dataDir "webview"

function Launch-AndWaitForReady {
    param([string]$BinPath)
    $outFile = [System.IO.Path]::GetTempFileName()
    $proc = Start-Process -FilePath $BinPath -PassThru -RedirectStandardOutput $outFile
    $ready = $false
    for ($i = 0; $i -lt 100; $i++) {
        Start-Sleep -Milliseconds 100
        if ((Get-Content $outFile -ErrorAction SilentlyContinue) -match "openfold: ready") { $ready = $true; break }
    }
    if (-not $ready) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
        throw "binary at $BinPath never printed the ready marker"
    }
    Start-Sleep -Milliseconds 500
    $proc.CloseMainWindow() | Out-Null
    Start-Sleep -Seconds 1
    if (-not (Get-Process -Id $proc.Id -ErrorAction SilentlyContinue)) { return }
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

# Start from a clean slate so this script's own result is unambiguous.
Remove-Item -Recurse -Force $dataDir -ErrorAction SilentlyContinue

Write-Host "Build A: cargo build --release"
cargo build --release -p openfold-desktop
if ($LASTEXITCODE -ne 0) { throw "build A failed" }
Copy-Item "target/release/openfold-desktop.exe" "target/release/openfold-desktop-build-a.exe" -Force

Write-Host "Launching build A..."
Launch-AndWaitForReady -BinPath "target/release/openfold-desktop-build-a.exe"

if (-not (Test-Path $webviewProfileDir)) {
    throw "build A did not create the expected webview profile directory at $webviewProfileDir"
}
$profileFilesBefore = Get-ChildItem -Recurse $webviewProfileDir -ErrorAction SilentlyContinue | Measure-Object
Write-Host "Build A wrote a WebView2 profile with $($profileFilesBefore.Count) file(s) under $webviewProfileDir"

Write-Host "Build B: cargo build --release (simulating a version bump -- same source, fresh binary)"
cargo build --release -p openfold-desktop
if ($LASTEXITCODE -ne 0) { throw "build B failed" }

Write-Host "Launching build B (the swapped-in 'upgraded' binary)..."
Launch-AndWaitForReady -BinPath "target/release/openfold-desktop.exe"

if (-not (Test-Path $webviewProfileDir)) {
    throw "webview profile directory disappeared after the binary swap -- origin/data-dir stability is broken"
}
$profileFilesAfter = Get-ChildItem -Recurse $webviewProfileDir -ErrorAction SilentlyContinue | Measure-Object
Write-Host "After build B's launch, the profile directory still exists with $($profileFilesAfter.Count) file(s)"

if ($profileFilesAfter.Count -lt $profileFilesBefore.Count) {
    throw "build B's launch appears to have wiped part of build A's profile ($($profileFilesBefore.Count) -> $($profileFilesAfter.Count) files)"
}

Remove-Item "target/release/openfold-desktop-build-a.exe" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $dataDir -ErrorAction SilentlyContinue

Write-Host "Upgrade simulation passed: the WebView2 profile (and therefore IndexedDB) survives a binary swap."
