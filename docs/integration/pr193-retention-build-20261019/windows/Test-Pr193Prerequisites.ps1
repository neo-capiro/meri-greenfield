<#
.SYNOPSIS
Read-only prerequisite diagnostics; emits fixed codes and non-secret versions only.
.DESCRIPTION
Checks path metadata only. Never opens PKI/Core contents, creates output, fetches Git,
installs dependencies, calls AWS, renders or uploads. Run with Windows PowerShell 5.1.
#>
[CmdletBinding()]
param([string]$PrivatePkiDirectory,[string]$CoreValuesPath,[string]$OutputDirectory,[string]$NodePath='node.exe')
$ErrorActionPreference='Stop'
try {
    . (Join-Path $PSScriptRoot 'Pr193Common.ps1')
    [Console]::WriteLine('PR193_DIAG_PS_VERSION=' + $PSVersionTable.PSVersion.ToString())
    [Console]::WriteLine('PR193_DIAG_DOTNET_VERSION=' + [Environment]::Version.ToString())
    try {
        Assert-Pr193NoReparsePoint ([IO.Path]::GetPathRoot([Environment]::SystemDirectory))
        [Console]::WriteLine('PR193_DIAG_DRIVE_ROOT_TRAVERSAL_PASS')
    } catch { [Console]::WriteLine('PR193_DIAG_DRIVE_ROOT_TRAVERSAL_FAILED') }
    foreach($row in @(@('PKI',$PrivatePkiDirectory,'Container'),@('CORE',$CoreValuesPath,'Leaf'),@('OUTPUT',$OutputDirectory,'New'))) {
        $label=$row[0]
        try {
            if([string]::IsNullOrWhiteSpace($row[1]) -or -not [IO.Path]::IsPathRooted($row[1])) { throw 'ABSOLUTE_REQUIRED' }
            Assert-Pr193NoReparsePoint $row[1]
            $full=[IO.Path]::GetFullPath($row[1])
            if($row[2] -eq 'New') {
                if(Test-Path -LiteralPath $full){[Console]::WriteLine('PR193_DIAG_OUTPUT_ALREADY_EXISTS')}
                elseif(-not (Test-Path -LiteralPath ([IO.Path]::GetDirectoryName($full)) -PathType Container)){[Console]::WriteLine('PR193_DIAG_OUTPUT_PARENT_MISSING')}
                else{[Console]::WriteLine('PR193_DIAG_OUTPUT_METADATA_PASS')}
            } elseif(Test-Path -LiteralPath $full -PathType $row[2]){[Console]::WriteLine('PR193_DIAG_'+$label+'_METADATA_PASS')}
            else{[Console]::WriteLine('PR193_DIAG_'+$label+'_EXPECTED_TYPE_MISSING')}
        } catch { [Console]::WriteLine('PR193_DIAG_'+$label+'_PATH_CHECK_FAILED') }
    }
    foreach($row in @(@('NODE',$NodePath,'--version'),@('GIT','git.exe','--version'))) {
        $label=$row[0];$command=$null
        try{
            $commands=@(Get-Command $row[1] -CommandType Application -ErrorAction Stop)
            [Console]::WriteLine('PR193_DIAG_'+$label+'_COMMAND_MATCHES='+$commands.Count)
            $command=$commands[0].Source
        }
        catch{[Console]::WriteLine('PR193_DIAG_'+$label+'_COMMAND_UNAVAILABLE');continue}
        try {
            $result=Invoke-Pr193Captured -FilePath $command -ArgumentList @($row[2]) -WorkingDirectory ([IO.Path]::GetDirectoryName($command)) -TimeoutSeconds 30 -Environment @{NODE_OPTIONS=$null;NODE_PATH=$null}
            $version=$result.Stdout.Trim()
            if($result.ExitCode -ne 0){throw 'VERSION_FAILED'}
            if($label -eq 'NODE' -and $version -cmatch '^v[0-9]+\.[0-9]+\.[0-9]+$'){
                [Console]::WriteLine('PR193_DIAG_NODE_VERSION='+$version)
                if($version -notmatch '^v24\.'){[Console]::WriteLine('PR193_DIAG_NODE24_REQUIRED')}
            } elseif($label -eq 'GIT' -and $version -cmatch '^git version [0-9]+\.[0-9]+\.[0-9]+(?:\.[A-Za-z0-9]+)*$'){
                [Console]::WriteLine('PR193_DIAG_GIT_VERSION='+$version.Substring(12))
            } else{[Console]::WriteLine('PR193_DIAG_'+$label+'_VERSION_RESPONSE_REFUSED')}
        } catch {[Console]::WriteLine('PR193_DIAG_'+$label+'_PROCESS_START_OR_VERSION_FAILED')}
    }
    [Console]::WriteLine('PR193_DIAG_COMPLETE_NO_PRIVATE_CONTENT_READ')
} catch {[Console]::WriteLine('PR193_DIAG_SETUP_FAILED')}
