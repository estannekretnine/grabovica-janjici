# Povezuje origin i šalje main na GitHub.
# Iz korena repozitorijuma:
#   .\scripts\push-to-github.ps1 -Owner tvoj_github_nalog
# Ili pun URL:
#   .\scripts\push-to-github.ps1 -RemoteUrl https://github.com/tvoj_nalog/grabovica-janjici.git

param(
  [string] $Owner,
  [string] $RemoteUrl,
  [string] $Repo = "grabovica-janjici"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if ($RemoteUrl) {
  $url = $RemoteUrl
} elseif ($Owner) {
  $url = "https://github.com/$Owner/$Repo.git"
} else {
  Write-Host "Navedite -Owner github_nalog ili -RemoteUrl https://github.com/.../grabovica-janjici.git" -ForegroundColor Yellow
  exit 1
}

if (git remote get-url origin 2>$null) {
  git remote set-url origin $url
  Write-Host "Ažuriran origin -> $url"
} else {
  git remote add origin $url
  Write-Host "Dodat origin -> $url"
}

git push -u origin main
