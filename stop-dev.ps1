$ErrorActionPreference='Stop'
$statePath=Join-Path $PSScriptRoot 'runtime\processes.json'
if(-not(Test-Path -LiteralPath $statePath)){Write-Host 'No owned process ledger.';exit 0}
$state=Get-Content -LiteralPath $statePath -Raw|ConvertFrom-Json
if($state.root -ne $PSScriptRoot){throw 'Process ledger belongs to another directory.'}
foreach($service in @('backend','frontend')){
    $servicePid=$state.$service
    $info=Get-CimInstance Win32_Process -Filter "ProcessId=$servicePid" -ErrorAction SilentlyContinue
    if($info -and (($info.CommandLine -and $info.CommandLine.Contains($PSScriptRoot)) -or ($info.ExecutablePath -and $info.ExecutablePath.StartsWith((Join-Path $PSScriptRoot '.venv\'))))){
        $children=Get-CimInstance Win32_Process -Filter "ParentProcessId=$servicePid" -ErrorAction SilentlyContinue
        foreach($child in $children){Stop-Process -Id $child.ProcessId -ErrorAction SilentlyContinue}
        Stop-Process -Id $servicePid -ErrorAction SilentlyContinue
        Write-Host "Stopped owned $service process $servicePid."
    }else{Write-Host "No matching owned $service process to stop."}
}
Write-Host 'Persistent data preserved.'
