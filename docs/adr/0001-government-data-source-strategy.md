# 0001：政府資料來源採混合路線

產品需要證件到期日與津貼到期日。一戶通提供官方 OAuth2 API（scope=profile，返回 `identityDocs.identityValidDate`），但需向行政公職局申請 client_id，且津貼到期日沒有任何公開 API。

決策：證件到期日走官方一戶通 OAuth 整合（真實申請若獲批；比賽 demo 用 UAT／模擬數據），津貼到期日用手動輸入＋OCR；以資料來源抽象層隔離，未來可插入新來源。

## Considered Options

- 全部走官方 API：津貼無接口，不可行。
- 全部手動輸入：身份證到期日明明有官方接口，放棄可惜且比賽可信度低。
