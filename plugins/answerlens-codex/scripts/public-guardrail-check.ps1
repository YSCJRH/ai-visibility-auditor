param(
  [string]$Repo = (Get-Location).Path,
  [switch]$Full
)

$ErrorActionPreference = "Stop"

Push-Location $Repo
try {
  if (-not (Test-Path "package.json")) {
    throw "package.json not found in $Repo"
  }

  $package = Get-Content "package.json" -Raw | ConvertFrom-Json
  if ($package.name -ne "answerlens-workspace") {
    throw "This does not look like the AnswerLens workspace. package.json name is '$($package.name)'."
  }

  corepack pnpm public:check

  if ($Full) {
    corepack pnpm demo:fixture
    corepack pnpm test
    corepack pnpm typecheck
  }
}
finally {
  Pop-Location
}
