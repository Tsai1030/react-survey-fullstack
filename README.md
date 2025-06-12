# React Survey Fullstack

這個專案是一個簡易的前後端整合範例，前端使用 Vite + React，後端使用 Express 與 PostgreSQL。

## 使用方式

1. 複製環境設定檔

```bash
cp .env.example .env
cp backend/.env.example backend/.env
```

2. 根據實際環境編輯 `.env` 與 `backend/.env`，設定 API URL、資料庫帳號等參數。

3. 安裝依賴並啟動服務

```bash
npm install
npm run dev
```

後端在 `backend` 目錄下，可使用以下指令啟動：

```bash
cd backend
npm install
npm start
```

前端預設會連線到 `http://localhost:10000`，可依需求調整。
