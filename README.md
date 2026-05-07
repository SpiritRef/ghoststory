# # ghoststory

這是一個輕量化的自動化日誌與小說發佈系統。透過 **Google Apps Script (GAS)** 作為中控，將資料從 Google 生態系同步至 GitHub，並利用 **GitHub Pages** 呈現動態前端頁面。

*   **📖 讀者前台：** [日誌庫](https://spiritref.github.io/ghoststory/)
*   **⚙️ 內容後台：** [後台管理頁面](https://spiritref.github.io/ghoststory/inputData.html)

---

## 🚀 系統特色

*   **自動化資料流**：利用 App Script 透過 GitHub Token 讀取並寫入最新 JSON 檔案，達成內容自動同步。
*   **混合快取機制**：系統優先讀取 `LocalStorage` 緩存讓頁面秒開，同時在背景對比 GitHub 最新資料，確保內容不落後。
*   **配置解耦**：選單內容與 API 網址皆儲存於 `settings/postFB.ini`，無需修改程式碼即可調整系統參數。

---

## 🛠️ 技術架構

### 前端實作
*   **語言**：Vanilla JavaScript (ES6+), HTML5, CSS3。
*   **搜尋引擎**：支援標題與全文內容即時檢索。
*   **分頁系統**：支援自定義每頁筆數 (20 / 50 / 100 / 全部)。
*   **收藏系統**：透過 LocalStorage 紀錄喜愛文章，支援離線標記與「僅看收藏」過濾模式。
*   **多媒體處理**：自動解析多圖欄位（支援換行或 `|` 分隔），具備自動防錯與隱藏失效圖片機制。

---

## 📂 檔案結構

| 檔案 / 資料夾 | 說明 |
| :--- | :--- |
| `index.html` | 主列表頁，負責搜尋、排序與分頁顯示。 |
| `article.html` | 文章內容頁，根據 ID 自動渲染全文。 |
| `inputData.html` | 後台管理介面。 |
| `API.js` | 核心模組，處理 INI 解析與 API 通訊。 |
| `settings/postFB.ini` | 系統設定檔（選單、API 路徑）。 |
| `main.js` | 主要邏輯控制與資料渲染引擎。 |

---

## ⚙️ 設定說明

若要更改系統配置，請編輯 `settings/postFB.ini`：
```ini
# MENU_DATA 格式：顯示名稱,連結網址,圖示符號|...
MENU_DATA=服務項目,../services/,📜|返回列表,index.html,🏠|關於我,../services/about/,👤

# API_URL 為 Base64 加密後的網址
API_URL=YUhSMGNEb3ZMMlV1WVhCd0xtTnZiUzlzYVdkekxtcHpiMjQ9
