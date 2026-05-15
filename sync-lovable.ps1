# sync-lovable.ps1
param([switch]$Full)

$lovableRepo = "C:\DEV\partner-port-pro"
$codeApp = "C:\DEV\CSPCRMApp"
$refDir = "$codeApp\lovable-reference"
$diffFile = "$codeApp\lovable-diff.txt"
$lastSyncFile = "$codeApp\.last-lovable-sync"

# STEP 1: Pull
Write-Host "`n=== Step 1: Pull from GitHub ===" -ForegroundColor Cyan
Push-Location $lovableRepo
$beforePull = (git log --format="%H" -n 1)
git pull origin main
$afterPull = (git log --format="%H" -n 1)

# Determine base commit for diff
if ($Full) {
    # Show all commits (last 200)
    $baseCommit = (git log --format="%H" -n 201 | Select-Object -Last 1)
    Write-Host "  Mode: FULL (all history)" -ForegroundColor Yellow
} elseif (Test-Path $lastSyncFile) {
    $baseCommit = (Get-Content $lastSyncFile).Trim()
    $commitCount = (git rev-list "$baseCommit..$afterPull" --count 2>$null)
    Write-Host "  Mode: Since last sync ($commitCount commits)" -ForegroundColor Green
} else {
    # First run — default to last 15 commits
    $baseCommit = (git log --format="%H" -n 16 | Select-Object -Last 1)
    Write-Host "  Mode: First run (last 15 commits)" -ForegroundColor Yellow
}

# STEP 2: Commits since last sync
Write-Host "`n=== Step 2: Commits since last sync ===" -ForegroundColor Yellow
git log --oneline "$baseCommit..$afterPull" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  (could not compute range, showing last 15)" -ForegroundColor DarkYellow
    git log --oneline -15
}

# STEP 3: Sync source files
Write-Host "`n=== Step 3: Syncing ===" -ForegroundColor Green
$folders = @("pages", "types", "components", "data")
foreach ($f in $folders) {
    if (Test-Path "src\$f") {
        $dp = "$refDir\$f"
        if (!(Test-Path $dp)) { New-Item -ItemType Directory -Path $dp -Force | Out-Null }
        Copy-Item -Path "src\$f\*" -Destination "$dp\" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Synced: src\$f" -ForegroundColor Gray
    }
}
if (Test-Path "src\lib") {
    $dp = "$refDir\lib"
    if (!(Test-Path $dp)) { New-Item -ItemType Directory -Path $dp -Force | Out-Null }
    Copy-Item -Path "src\lib\*" -Destination "$dp\" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Synced: src\lib" -ForegroundColor Gray
}

# STEP 3b: Sync Business Logic folder
Write-Host "" -ForegroundColor Gray
if (Test-Path "Business Logic") {
    $blDir = "$refDir\business-logic"
    if (!(Test-Path $blDir)) { New-Item -ItemType Directory -Path $blDir -Force | Out-Null }
    Copy-Item -Path "Business Logic\*" -Destination "$blDir\" -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "  Synced: Business Logic" -ForegroundColor Gray
}

# STEP 4: Compare pages
Write-Host "`n=== Step 4: Compare ===" -ForegroundColor Magenta
$lp = Get-ChildItem -Path "$refDir\pages" -Filter "*.tsx" -EA SilentlyContinue | % { $_.Name }
$cp = Get-ChildItem -Path "$codeApp\src\pages" -Filter "*.tsx" -EA SilentlyContinue | % { $_.Name }

Write-Host "`n  Pages only in Lovable:" -ForegroundColor Red
$ol = $lp | Where-Object { $_ -notin $cp }
if ($ol) { $ol | % { Write-Host "    + $_" -ForegroundColor Red } } else { Write-Host "    (none)" -ForegroundColor Gray }

Write-Host "`n  Pages only in Code App:" -ForegroundColor Yellow
$oc = $cp | Where-Object { $_ -notin $lp }
if ($oc) { $oc | % { Write-Host "    - $_" -ForegroundColor Yellow } } else { Write-Host "    (none)" -ForegroundColor Gray }

Write-Host "`n  Common pages:" -ForegroundColor Cyan
$common = $lp | Where-Object { $_ -in $cp }
foreach ($pg in $common) {
    $ls = (Get-Item "$refDir\pages\$pg").Length
    $cs = (Get-Item "$codeApp\src\pages\$pg" -EA SilentlyContinue).Length
    $d = $ls - $cs
    if ($d -gt 0) { $ds = "+$d bytes (Lovable bigger)" } elseif ($d -lt 0) { $ds = "$d bytes (Code App bigger)" } else { $ds = "same" }
    $clr = if ([Math]::Abs($d) -gt 500) { "Yellow" } else { "Gray" }
    Write-Host ("    {0,-35} Lov:{1,6} Code:{2,6} {3}" -f $pg,$ls,$cs,$ds) -ForegroundColor $clr
}

# STEP 5: New components
Write-Host "`n  New Lovable components:" -ForegroundColor Red
$lc = Get-ChildItem -Path "$refDir\components" -Filter "*.tsx" -Recurse -EA SilentlyContinue | % { $_.FullName.Replace("$refDir\components\","") }
$cc = Get-ChildItem -Path "$codeApp\src\components" -Filter "*.tsx" -Recurse -EA SilentlyContinue | % { $_.FullName.Replace("$codeApp\src\components\","") }
$nc = $lc | Where-Object { $_ -notin $cc }
if ($nc) { $nc | % { Write-Host "    + $_" -ForegroundColor Red } } else { Write-Host "    (none)" -ForegroundColor Gray }

# STEP 6: Types
Write-Host "`n  Types crm.ts:" -ForegroundColor Cyan
$lt = "$refDir\types\crm.ts"
$ct = "$codeApp\src\types\crm.ts"
if ((Test-Path $lt) -and (Test-Path $ct)) {
    $ll = (Get-Content $lt).Count
    $cl = (Get-Content $ct).Count
    Write-Host "    Lovable: $ll lines | CodeApp: $cl lines" -ForegroundColor Gray
    $lf = Get-Content $lt | Select-String -Pattern '^\s+\w+[\?]?:' | % { $_.Line.Trim() }
    $cf = Get-Content $ct | Select-String -Pattern '^\s+\w+[\?]?:' | % { $_.Line.Trim() }
    $nf = $lf | Where-Object { $_ -notin $cf }
    if ($nf) { Write-Host "    New fields:" -ForegroundColor Yellow; $nf | % { Write-Host "      + $_" -ForegroundColor Yellow } }
    else { Write-Host "    All fields in sync" -ForegroundColor Green }
}

# STEP 6b: Business Logic Changelog
Write-Host "`n=== Step 5b: Business Logic Changelog ===" -ForegroundColor Magenta
$changelog = "$refDir\business-logic\Changelog.md"
if (Test-Path $changelog) {
    Write-Host "  Latest entries from Changelog.md:" -ForegroundColor Cyan
    $clContent = Get-Content $changelog -Raw
    # Extract entries between --- separators (show first 3)
    $entries = $clContent -split '---' | Where-Object { $_.Trim().StartsWith('##') } | Select-Object -First 5
    foreach ($entry in $entries) {
        $lines = ($entry.Trim() -split "`n") | Where-Object { $_.Trim() }
        foreach ($ln in $lines) {
            if ($ln.StartsWith('##')) { Write-Host "  $ln" -ForegroundColor Yellow }
            elseif ($ln.StartsWith('**')) { Write-Host "  $ln" -ForegroundColor Gray }
            elseif ($ln.StartsWith('-')) { Write-Host "  $ln" -ForegroundColor White }
            else { Write-Host "  $ln" -ForegroundColor DarkGray }
        }
        Write-Host "" -ForegroundColor Gray
    }
} else {
    Write-Host "  (no Changelog.md found)" -ForegroundColor DarkYellow
}

# STEP 7: Files changed since last sync
Write-Host "`n=== Step 7: Files changed (since last sync) ===" -ForegroundColor Cyan
$changed = git diff "$baseCommit..$afterPull" --name-only 2>$null
if ($changed) { $changed | % { Write-Host "    $_" -ForegroundColor White } }
else { Write-Host "    (no changes)" -ForegroundColor Gray }

Write-Host "`n  Stat:" -ForegroundColor Gray
git diff "$baseCommit..$afterPull" --stat 2>$null

# STEP 8: Full diffs per file
Write-Host "`n=== Step 8: Full diffs ===" -ForegroundColor Magenta

$fullDiff = git diff "$baseCommit..$afterPull" 2>$null
if ($fullDiff) {
    $fullDiff | Out-File -FilePath $diffFile -Encoding utf8 -Force
    Write-Host "  Full diff saved to: $diffFile" -ForegroundColor Green
}

if ($changed) {
    foreach ($file in $changed) {
        Write-Host "`n  --- $file ---" -ForegroundColor White
        $fd = git diff "$baseCommit..$afterPull" -- $file 2>$null
        if (!$fd) { continue }
        $lines = $fd -split "`n"
        $total = $lines.Count

        $showCount = if ($total -le 80) { $total } else { 40 }

        for ($i = 0; $i -lt $showCount -and $i -lt $total; $i++) {
            $ln = $lines[$i]
            if ($ln.StartsWith('+') -and !$ln.StartsWith('+++')) { Write-Host "  $ln" -ForegroundColor Green }
            elseif ($ln.StartsWith('-') -and !$ln.StartsWith('---')) { Write-Host "  $ln" -ForegroundColor Red }
            elseif ($ln.StartsWith('@@')) { Write-Host "  $ln" -ForegroundColor Cyan }
            else { Write-Host "  $ln" -ForegroundColor Gray }
        }

        if ($total -gt 80) {
            Write-Host "  ... ($($total - 60) lines omitted, see $diffFile) ..." -ForegroundColor DarkYellow
            for ($i = [Math]::Max(0, $total - 20); $i -lt $total; $i++) {
                $ln = $lines[$i]
                if ($ln.StartsWith('+') -and !$ln.StartsWith('+++')) { Write-Host "  $ln" -ForegroundColor Green }
                elseif ($ln.StartsWith('-') -and !$ln.StartsWith('---')) { Write-Host "  $ln" -ForegroundColor Red }
                elseif ($ln.StartsWith('@@')) { Write-Host "  $ln" -ForegroundColor Cyan }
                else { Write-Host "  $ln" -ForegroundColor Gray }
            }
        }
    }
}

# STEP 9: Save sync point
$afterPull | Out-File -FilePath $lastSyncFile -Encoding utf8 -Force
Write-Host "`n  Sync point saved: $($afterPull.Substring(0,7))" -ForegroundColor Green

Pop-Location

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "  Lovable ref: $refDir" -ForegroundColor Green
Write-Host "  Code App:    $codeApp\src" -ForegroundColor Green
Write-Host "  Business Logic: $refDir\business-logic" -ForegroundColor Green
if (Test-Path $diffFile) { Write-Host "  Full diff:   $diffFile" -ForegroundColor Green }
Write-Host ""
