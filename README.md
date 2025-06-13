## 🚀 ngrok 雙通道啟動與設定流程

本系統使用 ngrok 將本地前後端服務公開至網路上，供遠端使用者測試與連線。請依以下步驟操作：

---

### 1️⃣ 每次啟動 ngrok（前端）

每一次啟動 ngrok 都會產生新的網址，請記得同步更新 app 程式與 `vite.config.js` 中的 API 或 proxy 設定：

```bash
"C:\Users\user\Downloads\ngrok.exe" http 5173

### 2️⃣ 啟動後端服務
cd "C:\Users\user\Desktop\vite-react-tailwind-template\backend"
node index.js

### 3️⃣ 啟動前端服務
cd "C:\Users\user\Desktop\vite-react-tailwind-template"
npm run dev

### 4️⃣ 取得並設定 ngrok authtoken
請先登入 ngrok 並取得你的 authtoken：
👉 https://dashboard.ngrok.com/get-started/your-authtoken

然後在終端機輸入以下指令來綁定你的帳號：
D:ngrok config add-authtoken

### 5️⃣ 單一通道：啟動後端用 ngrok
ngrok http 5000

### 6️⃣ 雙通道設定與啟動（推薦）
🔧 建立 .ngrok2/ngrok.yml 設定檔
請在 C:\Users\user\.ngrok2 資料夾內建立 ngrok.yml 檔案，內容如下：
# 請將 authtoken 換成您自己的 ngrok 金鑰
authtoken: 2ixG5c68TBxeAmbAf3vLr40rlZU_7kHsKRPxnHMgn1ZkQxyjS
version: "2"
region: jp

tunnels:
  backend-api:
    proto: http
    addr: 5000
  frontend-site:
    proto: http
    addr: 5173
### ▶️ 啟動雙通道服務
ngrok start --all




