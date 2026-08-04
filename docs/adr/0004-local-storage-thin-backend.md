# 0004：事件存瀏覽器 localStorage，配薄後端

日曆事件與文檔原檔只存於用戶瀏覽器（事件放 localStorage、原檔放 IndexedDB，因 localStorage 容量不足以存檔案），不設資料庫；AI／OCR 處理與金鑰保管（LLM API key、一戶通 client_secret）放在無伺服器函數後端。

決策：demo 階段以「敏感資料不出裝置」為隱私賣點，跨裝置同步列為願景。代價：同一瀏覽器外無法存取事件，正式產品需遷移至資料庫。
