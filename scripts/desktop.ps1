param([ValidateSet('dev','build','test')][string]$Action = 'dev')
$ErrorActionPreference = 'Stop'
$cargoBin = Join-Path $env:USERPROFILE '.cargo\bin'
if (Test-Path $cargoBin) { $env:PATH = "$cargoBin;$env:PATH" }
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) { throw 'Install Rust first: https://rustup.rs' }
$rustHost = & rustc -vV
if (($rustHost -match 'host: x86_64-pc-windows-gnu') -and (Test-Path 'C:\msys64\ucrt64\bin\gcc.exe')) {
    $env:PATH = "C:\msys64\ucrt64\bin;$env:PATH"
}
Push-Location (Join-Path $PSScriptRoot '..')
try {
    if ($Action -eq 'test') { & cargo test --manifest-path src-tauri/Cargo.toml }
    elseif ($Action -eq 'build') { & npm run tauri build -- --bundles nsis }
    else { & npm run tauri dev }
    if ($LASTEXITCODE -ne 0) { throw "WorkLog $Action failed (exit $LASTEXITCODE)" }
} finally { Pop-Location }
