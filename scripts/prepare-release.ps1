#Requires -Version 5.1
<#
.SYNOPSIS
  Prepare a Good Night Games release from develop.

.PARAMETER Bump
  Semver segment to increment: major, minor, or patch.

.PARAMETER PreRelease
  Optional pre-release channel: alpha or beta. Omit for a stable release branch.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('major', 'minor', 'patch')]
    [string]$Bump,

    [Parameter(Mandatory = $false)]
    [ValidateSet('alpha', 'beta')]
    [string]$PreRelease
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert-CommandExists {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command not found: $Name"
    }
}

function Get-RepoRoot {
    $root = Resolve-Path (Join-Path $PSScriptRoot '..')
    return $root.Path
}

function Assert-CleanWorkingTree {
    param([string]$RepoRoot)
    Push-Location $RepoRoot
    try {
        $status = git status --porcelain
        if ($status) {
            throw "Working tree is not clean. Commit or stash changes before preparing a release.`n$status"
        }
    }
    finally {
        Pop-Location
    }
}

function Invoke-NpmVersion {
    param(
        [string]$AppDir,
        [string]$VersionArg
    )
    Push-Location $AppDir
    try {
        $output = npm version $VersionArg --no-git-tag-version 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "npm version failed in $AppDir`: $output"
        }
    }
    finally {
        Pop-Location
    }
}

function Get-PackageVersion {
    param([string]$PackageJsonPath)
    $pkg = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
    return [string]$pkg.version
}

function Invoke-Git {
    param(
        [string]$RepoRoot,
        [string[]]$Args
    )
    Push-Location $RepoRoot
    try {
        & git @Args
        if ($LASTEXITCODE -ne 0) {
            throw "git $($Args -join ' ') failed with exit code $LASTEXITCODE"
        }
    }
    finally {
        Pop-Location
    }
}

Assert-CommandExists 'git'
Assert-CommandExists 'npm'
Assert-CommandExists 'gh'

$repoRoot = Get-RepoRoot
Assert-CleanWorkingTree $repoRoot

$preReleaseSuffix = if ($PreRelease) { "-$PreRelease" } else { '' }

Write-Host "Fetching latest develop..."
Invoke-Git $repoRoot @('fetch', 'origin', 'develop')
Invoke-Git $repoRoot @('checkout', 'develop')
Invoke-Git $repoRoot @('pull', 'origin', 'develop')

Write-Host "Bumping $Bump version in frontend and backend..."
Invoke-NpmVersion (Join-Path $repoRoot 'frontend') $Bump
$baseVersion = Get-PackageVersion (Join-Path $repoRoot 'frontend/package.json')
Invoke-NpmVersion (Join-Path $repoRoot 'backend') $baseVersion

$frontendVersion = Get-PackageVersion (Join-Path $repoRoot 'frontend/package.json')
$backendVersion = Get-PackageVersion (Join-Path $repoRoot 'backend/package.json')
if ($frontendVersion -ne $backendVersion) {
    throw "Version mismatch after bump: frontend=$frontendVersion backend=$backendVersion"
}

$branchName = "release/${baseVersion}${preReleaseSuffix}"
$releaseLabel = "v${baseVersion}${preReleaseSuffix}"
$prTitleToDevelop = "$releaseLabel -> develop"
$prTitleToMain = "$releaseLabel -> main"

Push-Location $repoRoot
try {
    git show-ref --verify --quiet "refs/heads/$branchName" 2>$null
    if ($LASTEXITCODE -eq 0) {
        throw "Local branch already exists: $branchName"
    }
    $remoteBranch = git ls-remote --heads origin "refs/heads/$branchName"
    if ($remoteBranch) {
        throw "Remote branch already exists: origin/$branchName"
    }
}
finally {
    Pop-Location
}

Write-Host "Creating branch $branchName (package version $frontendVersion)..."
Invoke-Git $repoRoot @('checkout', '-b', $branchName)

Invoke-Git $repoRoot @(
    'add',
    'frontend/package.json',
    'frontend/package-lock.json',
    'backend/package.json',
    'backend/package-lock.json'
)

Invoke-Git $repoRoot @('commit', '-m', $releaseLabel)

Write-Host "Pushing $branchName..."
Invoke-Git $repoRoot @('push', '-u', 'origin', $branchName)

Push-Location $repoRoot
try {
    Write-Host "Opening pull requests..."
    $developPrUrl = gh pr create `
        --base develop `
        --head $branchName `
        --title $prTitleToDevelop `
        --body "Release preparation for $releaseLabel."

    if ($LASTEXITCODE -ne 0) {
        throw "gh pr create (develop) failed with exit code $LASTEXITCODE"
    }

    $mainPrUrl = gh pr create `
        --base main `
        --head $branchName `
        --title $prTitleToMain `
        --body "Release preparation for $releaseLabel."

    if ($LASTEXITCODE -ne 0) {
        throw "gh pr create (main) failed with exit code $LASTEXITCODE"
    }

    Write-Host "Creating GitHub release $releaseLabel..."
    $releaseArgs = @(
        $releaseLabel,
        '--target', $branchName,
        '--title', $releaseLabel,
        '--generate-notes'
    )
    if ($PreRelease) {
        $releaseArgs += '--prerelease'
    }

    $releaseUrl = gh release create @releaseArgs

    if ($LASTEXITCODE -ne 0) {
        throw "gh release create failed with exit code $LASTEXITCODE"
    }

    Write-Host ""
    Write-Host "Release prepared successfully."
    Write-Host "  Branch:       $branchName"
    Write-Host "  Version:      $frontendVersion"
    Write-Host "  Tag:          $releaseLabel"
    Write-Host "  PR (develop): $developPrUrl"
    Write-Host "  PR (main):    $mainPrUrl"
    Write-Host "  Release:      $releaseUrl"
}
finally {
    Pop-Location
}
