$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $projectRoot

function Write-Step($message) {
  Write-Host "`n=== $message ===" -ForegroundColor Cyan
}

function Assert-Command($commandName) {
  if (-not (Get-Command $commandName -ErrorAction SilentlyContinue)) {
    throw "Missing command: $commandName. Please install it and try again."
  }
}

function Assert-ExitCode($actionName) {
  if ($LASTEXITCODE -ne 0) {
    throw "$actionName failed with exit code $LASTEXITCODE"
  }
}

function Test-Url($url, $maxRetry = 20, $delaySeconds = 2) {
  for ($i = 1; $i -le $maxRetry; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri $url -Method Get -TimeoutSec 5
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        return $true
      }
    }
    catch {
      Start-Sleep -Seconds $delaySeconds
    }
  }
  return $false
}

function Resolve-BackendHealthUrl() {
  $defaultApi = 'http://127.0.0.1:3000/api'
  $apiBaseUrl = $defaultApi

  $envFiles = @('.env.production.local', '.env.production', '.env.local', '.env')
  foreach ($file in $envFiles) {
    if (Test-Path $file) {
      $lines = Get-Content $file
      foreach ($line in $lines) {
        if ($line -match '^VITE_API_BASE_URL=(.+)$') {
          $apiBaseUrl = $Matches[1].Trim()
          break
        }
      }
      if ($apiBaseUrl -ne $defaultApi) { break }
    }
  }

  if ($apiBaseUrl.EndsWith('/api')) {
    return $apiBaseUrl.Substring(0, $apiBaseUrl.Length - 4) + '/health'
  }

  return ($apiBaseUrl.TrimEnd('/')) + '/health'
}

try {
  Write-Step 'Checking prerequisites'
  Assert-Command node
  Assert-Command npm
  Assert-Command pm2

  Write-Step 'Checking dependencies'
  if (-not (Test-Path 'node_modules')) {
    Write-Host 'node_modules not found, running npm install --include=dev...' -ForegroundColor Yellow
    npm install --include=dev
    Assert-ExitCode 'npm install --include=dev'
  }
  else {
    Write-Host 'node_modules exists, skip reinstall.' -ForegroundColor Green
  }

  if (-not (Test-Path 'node_modules/.bin/vite.cmd')) {
    Write-Host 'vite CLI is missing, running npm install --include=dev to repair dependencies...' -ForegroundColor Yellow
    npm install --include=dev
    Assert-ExitCode 'npm install --include=dev (repair vite)'
  }

  Write-Step 'Building frontend assets'
  npm run build
  Assert-ExitCode 'npm run build'

  Write-Step 'Restarting PM2 frontend preview service'
  if (-not (Test-Path 'logs')) {
    New-Item -Path 'logs' -ItemType Directory | Out-Null
  }
  cmd /c "pm2 delete poker-scorekeeper-frontend >nul 2>nul" | Out-Null
  pm2 start ecosystem.frontend.config.cjs --only poker-scorekeeper-frontend
  Assert-ExitCode 'pm2 start frontend preview'
  pm2 save
  Assert-ExitCode 'pm2 save'

  $frontendUrl = 'http://127.0.0.1:5173'

  Write-Step "Frontend check: $frontendUrl"
  if (-not (Test-Url -url $frontendUrl)) {
    throw 'Frontend preview is not reachable at http://127.0.0.1:5173'
  }

  $backendHealthUrl = Resolve-BackendHealthUrl
  Write-Step "Backend health check: $backendHealthUrl"
  if (Test-Url -url $backendHealthUrl -maxRetry 5 -delaySeconds 1) {
    Write-Host 'Backend health check passed.' -ForegroundColor Green
  }
  else {
    Write-Host 'Backend health check failed. Frontend is up, but API may be unavailable.' -ForegroundColor Yellow
  }

  $lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress)

  Write-Host "`nFrontend local production deploy finished." -ForegroundColor Green
  Write-Host "Local URL: $frontendUrl"
  if ($lanIp) {
    Write-Host "LAN URL: http://${lanIp}:5173"
  }
  Write-Host 'Status: pm2 status'
  Write-Host 'Logs: pm2 logs poker-scorekeeper-frontend --lines 100'
}
catch {
  Write-Host "`nDeploy failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
