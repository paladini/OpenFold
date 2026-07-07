# Footprint budget measurement for Windows (design.md "Footprint measurement method").
# Run after `cargo build --release -p openfold-desktop`, from the repo root.
$ErrorActionPreference = "Stop"

$binPath = "target/release/openfold-desktop.exe"
$maxBinaryBytes = 10MB
$maxIdleRssBytes = 50MB
$maxColdStartMs = 2000

if (-not (Test-Path $binPath)) {
    Write-Error "binary not found at $binPath -- run 'cargo build --release -p openfold-desktop' first"
    exit 1
}

$binSize = (Get-Item $binPath).Length
Write-Host "Binary size: $([math]::Round($binSize / 1MB, 2)) MB"
if ($binSize -gt $maxBinaryBytes) {
    Write-Error "Binary size $binSize bytes exceeds the $maxBinaryBytes byte budget"
    exit 1
}

$outFile = [System.IO.Path]::GetTempFileName()
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath $binPath -PassThru -RedirectStandardOutput $outFile

$readySeen = $false
for ($i = 0; $i -lt 100; $i++) {
    Start-Sleep -Milliseconds 100
    if ((Get-Content $outFile -ErrorAction SilentlyContinue) -match "openfold: ready") {
        $readySeen = $true
        break
    }
}
$sw.Stop()

if (-not $readySeen) {
    Write-Error "cold-start ready marker not seen within 10s -- the SPA's startup ping never roundtripped"
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}
Write-Host "Cold start (process spawn -> ping roundtrip): $($sw.ElapsedMilliseconds) ms"
if ($sw.ElapsedMilliseconds -gt $maxColdStartMs) {
    Write-Error "Cold start $($sw.ElapsedMilliseconds) ms exceeds the $maxColdStartMs ms budget"
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

Start-Sleep -Seconds 10
$p = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
if (-not $p) {
    Write-Error "process exited unexpectedly before the idle-RAM measurement"
    exit 1
}
$rssBytes = $p.WorkingSet64
Write-Host "Idle host process RSS (webview processes excluded, per design.md): $([math]::Round($rssBytes / 1MB, 2)) MB"
Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue

if ($rssBytes -gt $maxIdleRssBytes) {
    Write-Error "Idle RSS $rssBytes bytes exceeds the $maxIdleRssBytes byte budget"
    exit 1
}

Write-Host "All footprint budgets passed."
