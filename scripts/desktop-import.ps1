# scripts/desktop-import.ps1
# 桌面右鍵匯入：把選取的檔案傳給本地代理抽取，結果進收件箱供瀏覽器輪詢入曆（見 docs/adr/0008）。
# 成功無聲（瀏覽器橫幅顯示入庫結果）；代理未啟動或連接失敗時彈出訊息框。
# 由 install-desktop-import.ps1 註冊到右鍵選單；Windows shell verb 對多選檔案逐檔呼叫一次本腳本。

param(
    [Parameter(Mandatory = $true)]
    [string[]]$FilePath
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms | Out-Null

$keyFile = Join-Path $PSScriptRoot '..\server\.desktop-key'
$analyzeEndpoint = 'http://localhost:3000/api/documents/analyze'

if (-not (Test-Path -LiteralPath $keyFile)) {
    [System.Windows.Forms.MessageBox]::Show(
        '尚未啟動本地代理伺服器，無法匯入文件。請先執行 npm run ai-proxy。',
        '一戶通智能日曆',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    exit 1
}

$proxyKey = (Get-Content -LiteralPath $keyFile -Raw).Trim()

foreach ($file in $FilePath) {
    if (-not (Test-Path -LiteralPath $file)) {
        continue
    }

    curl.exe -sS -o NUL -X POST `
        -H "X-Proxy-Key: $proxyKey" `
        -H "X-Stash: 1" `
        -F "file=@$file" `
        $analyzeEndpoint

    if ($LASTEXITCODE -ne 0) {
        [System.Windows.Forms.MessageBox]::Show(
            '無法連接 AI 服務，請確認已啟動本地代理（npm run ai-proxy）。',
            '一戶通智能日曆',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
        exit 1
    }
}

exit 0
