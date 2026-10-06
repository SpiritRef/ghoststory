# 鬼磕頭日誌 | 靈界紀實

這是一個輕量化的自動化日誌與小說發佈系統。透過 **Google Apps Script (GAS)** 作為中控，將資料從 Google 生態系同步至 GitHub，並利用 **GitHub Pages** 呈現動態前端頁面。

*   **📖 讀者前台：** [日誌庫](https://spiritref.github.io/ghoststory/)
*   **⚙️ 內容後台：** [後台管理頁面](https://spiritref.github.io/ghoststory/inputData.html)

---

## 🚀 系統特色

*   **自動化資料流**：利用 App Script 透過 GitHub Token 讀取並寫入最新 JSON 檔案，達成內容自動同步。
*   **混合快取機制**：系統優先讀取 `LocalStorage` 緩存讓頁面秒開，同時在背景對比 GitHub 最新資料，確保內容不落後。
*   **配置解耦**：選單內容與 API 網址皆儲存於 `settings/global.ini`，無需修改程式碼即可調整系統參數。
*   **牛皮紙質感設計**：全站採用統一的古典牛皮紙風格，提供沉浸式閱讀體驗。

---

## 🛠️ 技術架構

### 前端實作
*   **語言**：Vanilla JavaScript (ES6+), HTML5, CSS3。
*   **搜尋引擎**：支援標題與全文內容即時檢索。
*   **分頁系統**：支援自定義每頁筆數 (5 / 10 / 20 / 50 / 100 / 全部)。
*   **收藏系統**：透過 LocalStorage 紀錄喜愛文章，支援離線標記與「僅看收藏」過濾模式。
*   **深色模式**：支援淺色/深色主題切換，並記憶使用者偏好。
*   **字體調整**：支援文章頁面字體大小調整 (A+ / A-)。
*   **多媒體處理**：自動解析多圖欄位（支援換行或 `|` 分隔），具備自動防錯與隱藏失效圖片機制。

---

## 📂 檔案結構

| 檔案 / 資料夾 | 說明 |
| :--- | :--- |
| `index.html` | 主列表頁，負責搜尋、排序與分頁顯示。 |
| `article/index.html` | 文章內容頁，根據 ID 自動渲染全文。 |
| `inputData.html` | 後台管理介面。 |
| `Javascript/API.js` | 核心模組，處理 INI 解析與 API 通訊。 |
| `Javascript/postFB.js` | 主要邏輯控制與資料渲染引擎。 |
| `Javascript/inputData.js` | 後台管理邏輯（圖片上傳、資料匯入）。 |
| `settings/global.ini` | 系統設定檔（選單、API 路徑）。 |
| `Data/` | 資料儲存目錄（JSON 格式）。 |
| `pic/` | 圖片儲存目錄。 |
| `CSS/` | 樣式表目錄。 |

---

## ⚙️ 設定說明

若要更改系統配置，請編輯 `settings/global.ini`：

```ini
# MENU_DATA 格式：顯示名稱,連結網址,圖示符號|...
MENU_DATA=專業服務,/services/,📜|視覺紀錄,/services/#visual-records,📽|超自然現象彙典,/services/#faq-section,💡|聯絡方式,/services/#contact,👤|靈異日誌,/ghoststory/,📖

# API_URL 為 Base64 加密後的網址
NOVEL_API_URL=...
SERVICE_API_URL=...

# 靜態 JSON 備份路徑
JsonData=/Data/postFB_20260508.json
JsonService=/Data/Services_20260527.json
```

---

## 📝 資料格式

資料統一使用 **JSON 格式**，儲存於 `Data/` 目錄：

```json
[
  {
    "PostID": "123",
    "標題": "文章標題",
    "貼文內容": "文章內容...",
    "發佈日期": "2026-01-01T00:00:00",
    "圖片網址": "pic/example.jpg",
    "分類": "服務項目"
  }
]
```

---

## 🎨 設計風格

全站採用**牛皮紙質感古典風格**：
- **背景色**：`#f8f9fa` 淺灰
- **卡片質感**：牛皮紙漸層 `#f7ebd7 → #e6d3af`
- **卡片邊框**：`1px solid #dcbfa2` + 左側 `5px solid #8b7355`
- **標題顏色**：`#4a2e1b` 深褐色
- **內文顏色**：`#5c4332` 深棕色
- **字體**：系統字體（PingFang TC、Microsoft JhengHei）
