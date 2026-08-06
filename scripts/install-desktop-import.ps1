# scripts/install-desktop-import.ps1
# 把「加入一戶通日曆」註冊到 Windows 右鍵選單（HKCU\Software\Classes\*\shell，免管理員、僅當前使用者）。
# 移除：reg delete "HKCU\Software\Classes\*\shell\加入一戶通日曆" /f
# 用 PowerShell registry provider（-LiteralPath）寫入，避免 reg.exe 對含引號值的解析問題。

$ErrorActionPreference = 'Stop'

$scriptPath = Join-Path $PSScriptRoot 'desktop-import.ps1'
$command = "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`" -FilePath `"%1`""

# New-Item -Path 對 registry 的 * 有萬用字元展開問題（-LiteralPath 又不被 PowerShell 5.1 支援），
# 改用 .NET Registry API：CreateSubKey 路徑為純字面值、無萬用字元，SetValue('', ...) 設 (Default) 值。
$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Software\Classes\*\shell\加入一戶通日曆\command')
$key.SetValue('', $command)
$key.Close()

Write-Host '已註冊右鍵選單「加入一戶通日曆」。'
Write-Host "命令：$command"
