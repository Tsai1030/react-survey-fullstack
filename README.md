# React 問卷全端範例

此專案提供一個簡易的全端範例，由 React 前端與 Node.js/Express 後端組成。
使用者可透過表單填寫問卷，資料會儲存在關聯式資料庫中。

## 專案結構

```
react-survey-fullstack/
├─ backend/   # Express API 伺服器
└─ frontend/  # 使用 Vite 與 Tailwind CSS 的 React 前端
```

## 先決條件

- Node.js（建議 18 版以上）
- 可運作的 PostgreSQL（或 MySQL）資料庫

## 設定步驟

1. **安裝相依套件**

   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```

2. **設定環境變數**

   建立 `backend/.env` 檔案並定義 `DATABASE_URL`，以 PostgreSQL 為例：

   ```bash
   DATABASE_URL=postgres://user:password@localhost:5432/react_survey
   PORT=5000        # optional, defaults to 5000
   ```

3. **啟動伺服器**

   在兩個終端機中分別執行：

   ```bash
   # 後端 API
   cd backend
   npm start

   # 前端
   cd ../frontend
   npm run dev
   ```

   React 應用程式預設在 <http://localhost:5173>，後端 API 則在
   <http://localhost:5000>。

## 資料庫結構

後端將資料存放在 `respondents` 與 `answers` 兩個資料表，
以下為對應的 MySQL 建表語法：

```sql
CREATE TABLE respondents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  gender      VARCHAR(50)  NOT NULL,
  education   VARCHAR(255) NOT NULL
);

CREATE TABLE answers (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  respondent_id      INT NOT NULL,
  question_id        INT NOT NULL,
  model_answer_index INT NOT NULL,
  accuracy           INT,
  completeness       INT,
  is_preferred       BOOLEAN,
  FOREIGN KEY (respondent_id) REFERENCES respondents(id)
);
```

## MySQL 查詢範例

插入一位受訪者及其相關回答：

```sql
INSERT INTO respondents (name, gender, education)
VALUES ('Alice', '女', '大學');

INSERT INTO answers (respondent_id, question_id, model_answer_index,
                     accuracy, completeness, is_preferred)
VALUES (LAST_INSERT_ID(), 1, 0, 3, 5, TRUE);
```

查詢所有包含受訪者資料的回答：

```sql
SELECT r.name, r.gender, r.education,
       a.question_id, a.model_answer_index,
       a.accuracy, a.completeness, a.is_preferred
FROM answers a
JOIN respondents r ON r.id = a.respondent_id
ORDER BY r.id, a.question_id, a.model_answer_index;
```

依題目彙總正確度與完整度：

```sql
SELECT question_id,
       AVG(accuracy)     AS avg_accuracy,
       AVG(completeness) AS avg_completeness
FROM answers
GROUP BY question_id;
```

## 部署

程式碼可部署到任何提供 Node.js 的平台。前端採用 Vite 進行開發並編譯
為靜態檔案，後端則透過環境變數 `DATABASE_URL` 連線到資料庫。

---

可依需求調整資料表結構或 API 端點。
