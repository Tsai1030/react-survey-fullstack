# React Survey Fullstack

這個專案是一個簡易的前後端整合範例，前端使用 Vite + React，後端使用 Express 搭配 MySQL。

## 使用方式

1. 複製環境設定檔

```bash
cp form-frontend/.env.example form-frontend/.env
cp form-backend/.env.example form-backend/.env
```

2. 根據實際環境編輯 `.env` 與 `form-backend/.env`，設定 API URL、資料庫帳號等參數。

   `form-backend/.env` 需提供 MySQL 連線資訊，例如：

   ```bash
   DB_USER=myuser
   DB_PASSWORD=mypassword
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=survey_db
   ```

3. 安裝依賴並啟動服務

```bash
cd form-frontend
npm install
npm run dev
```

後端在 `form-backend` 目錄下，可使用以下指令啟動：

```bash
cd form-backend
npm install
npm start
```

前端預設會連線到 `http://localhost:10000`，可依需求調整。
