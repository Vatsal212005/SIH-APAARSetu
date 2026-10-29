param([switch]$OpenBrave,[switch]$Demo)
$ErrorActionPreference='Stop'
$projectRoot=$PSScriptRoot
Set-Location -LiteralPath $projectRoot
$runtimePath=Join-Path $projectRoot 'runtime'
New-Item -ItemType Directory -Force -Path $runtimePath | Out-Null
$pythonPath=Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not(Test-Path -LiteralPath $pythonPath)) { & (Join-Path $projectRoot 'scripts\setup.ps1') }
$env:TEMP=Join-Path $runtimePath 'tmp';$env:TMP=$env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
if($Demo){$env:APAARSETU_DEMO_MODE='true'}
$existing=$false
try { $health=Invoke-RestMethod 'http://127.0.0.1:8001/health' -TimeoutSec 3; $existing=($health.project_root -eq $projectRoot); if(-not $existing){throw 'Foreign service on port 8001'} } catch { if($_.Exception.Message -eq 'Foreign service on port 8001'){throw} }
if($existing){
    try { $web=Invoke-WebRequest 'http://127.0.0.1:3001/login' -UseBasicParsing -TimeoutSec 5; if($web.StatusCode -eq 200){Write-Host 'Existing APAARSetu services healthy: http://localhost:3001';exit 0} } catch {}
    throw 'APAARSetu backend is running but frontend is unavailable. Run stop-dev.ps1 then start again.'
}
foreach($port in @(8001,3001)){if(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue){throw "Port $port is occupied; no unrelated process was stopped."}}
$initializeArgs=@((Join-Path $projectRoot 'scripts\initialize.py'));if($Demo){$initializeArgs+='--demo'}
& $pythonPath @initializeArgs
if($LASTEXITCODE -ne 0){throw 'Database migrations/initialization failed.'}
$backendScript=Join-Path $projectRoot 'scripts\run_backend.py'
$backend=Start-Process -FilePath $pythonPath -ArgumentList @('"'+$backendScript+'"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'backend.log') -RedirectStandardError (Join-Path $runtimePath 'backend.err.log') -PassThru
$nextPath=Join-Path $projectRoot 'frontend\node_modules\next\dist\bin\next'
$frontend=Start-Process -FilePath (Get-Command node.exe).Source -ArgumentList @('"'+$nextPath+'"','dev','-p','3001','--hostname','127.0.0.1') -WorkingDirectory (Join-Path $projectRoot 'frontend') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $runtimePath 'frontend.log') -RedirectStandardError (Join-Path $runtimePath 'frontend.err.log') -PassThru
@{backend=$backend.Id;frontend=$frontend.Id;root=$projectRoot;started=(Get-Date).ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtimePath 'processes.json')
$ready=$false
for($attempt=0;$attempt -lt 60;$attempt++){
    $backend.Refresh();$frontend.Refresh()
    if($backend.HasExited -or $frontend.HasExited){Get-Content (Join-Path $runtimePath 'backend.err.log') -Tail 15;Get-Content (Join-Path $runtimePath 'frontend.err.log') -Tail 15;throw 'APAARSetu service exited during startup.'}
    try { $health=Invoke-RestMethod 'http://127.0.0.1:8001/health' -TimeoutSec 2;$web=Invoke-WebRequest 'http://127.0.0.1:3001/login' -UseBasicParsing -TimeoutSec 3;if($health.status -eq 'healthy' -and $web.StatusCode -eq 200){$ready=$true;break} } catch {Start-Sleep -Milliseconds 500}
}
if(-not $ready){throw 'Health check timed out. Inspect runtime logs.'}
Write-Host 'APAARSetu ready: http://localhost:3001 | http://localhost:8001/docs'
if($OpenBrave){$bravePath='C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe';if(Test-Path -LiteralPath $bravePath){Start-Process -FilePath $bravePath -ArgumentList 'http://localhost:3001'}}
