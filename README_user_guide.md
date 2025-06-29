### Render 表單網址

https://form-frontend-u3x9.onrender.com/


# 📊 問卷資料庫查詢與匯出說明

本專案使用 PostgreSQL 資料庫儲存問卷填寫結果，以下提供常用查詢語法與匯出說明，方便進行資料分析或備份。

---

## 📌 資料表結構

## 📝 問卷資料表欄位說明（拖曳排序版本）

| 欄位名稱             | 資料型別 | 說明                                  |
|----------------------|----------|---------------------------------------|
| 填答者ID             | INTEGER  | respondents 表主鍵 ID                 |
| 身分                 | TEXT     | 使用者身分（教師、學生、職員等）     |
| 性別                 | TEXT     | 使用者性別                            |
| 參與年資             | TEXT     | 使用者參與 USR 計畫的年度            |
| LLM熟悉度            | INTEGER  | 使用者對大型語言模型的熟悉程度（1~7）|
| 問題ID               | INTEGER  | 問卷中的題目編號                      |
| 模型回答             | INTEGER  | 第幾個模型的回答（1 表示模型 1）     |
| 名次                 | INTEGER  | 受測者對該回答的排序名次（1~3）       |
| 填答時間             | DATETIME | 表單實際填寫時間                      |

---

## 📄 常用 SQL 查詢語法

### 查詢填寫人數
```sql
SELECT 
    COUNT(DISTINCT r.id) AS 填答者人數
FROM 
    respondents r
JOIN 
    rankings k ON r.id = k.respondent_id;
```

### ✅ ✨最主要查詢個模型排名總表

```sql
-- 將下面的「1」換成您想分析的問題 ID
SELECT 
    question_id,
    model_answer_index + 1 AS "模型回答",
    COUNT(CASE WHEN rank = 1 THEN 1 END) AS "被評為第一名的次數",
    COUNT(CASE WHEN rank = 2 THEN 1 END) AS "被評為第二名的次數",
    COUNT(CASE WHEN rank = 3 THEN 1 END) AS "被評為第三名的次數"
FROM 
    rankings
WHERE 
    question_id = [請填入你想查詢的問題ID]  -- <--- 在這裡修改問題 ID
GROUP BY 
    question_id, model_answer_index
ORDER BY 
    "模型回答";
```
## ✅ 🧪使用id查詢

```sql
-- ▼▼▼ 在這裡修改 ID ▼▼▼
SELECT 
    r.id AS "填答者ID",
    r.identity AS "身分",
    r.gender AS "性別",
    k.question_id AS "問題ID",
    k.model_answer_index + 1 AS "模型回答",
    k.rank AS "名次"
FROM 
    respondents r
JOIN 
    rankings k ON r.id = k.respondent_id
WHERE 
    r.id = [請填入你想查詢的填答者ID]  -- 例如： r.id = 2
ORDER BY 
    k.question_id, k.rank;

```

## ✅ 所有問題的「排名分佈」與「加權分數」統計 

```sql
WITH ScoredRankings AS (
    SELECT
        question_id,
        model_answer_index,
        -- 給予加權分數：第1名得3分，第2名得2分，第3名得1分
        CASE 
            WHEN rank = 1 THEN 3
            WHEN rank = 2 THEN 2
            WHEN rank = 3 THEN 1
            ELSE 0 
        END AS score
    FROM 
        rankings
)
SELECT 
    s.question_id AS "問題ID",
    s.model_answer_index + 1 AS "模型回答",
    -- 計算各名次的總票數
    COUNT(CASE WHEN r.rank = 1 THEN 1 END) AS "第一名票數",
    COUNT(CASE WHEN r.rank = 2 THEN 1 END) AS "第二名票數",
    COUNT(CASE WHEN r.rank = 3 THEN 1 END) AS "第三名票數",
    -- 計算加權分數
    SUM(s.score) AS "加權總分",
    ROUND(AVG(s.score), 2) AS "平均分數"
FROM 
    ScoredRankings s
JOIN 
    rankings r ON s.question_id = r.question_id AND s.model_answer_index = r.model_answer_index
GROUP BY 
    s.question_id, s.model_answer_index
ORDER BY 
    "問題ID" ASC, "平均分數" DESC;
```

## ✅ 所有原始排序紀錄 (Raw Data)

```sql
SELECT 
    r.id AS "填答者ID",
    r.identity AS "身分",
    r.gender AS "性別",
    r.participation_year AS "參與年資",
    r.llm_familiarity AS "LLM熟悉度",
    k.question_id AS "問題ID",
    k.model_answer_index + 1 AS "模型回答",
    k.rank AS "名次",
    r.created_at AS "填答時間"
FROM 
    respondents r
JOIN 
    rankings k ON r.id = k.respondent_id
ORDER BY 
    r.id, k.question_id, k.rank;
```

## ✅ 請複製以下語法，並將 [請填入你想刪除的填答者ID] 換成您要刪除的數字。

```sql
-- ▼▼▼ 在這裡修改要刪除的 ID ▼▼▼
DELETE FROM respondents
WHERE id = [請填入你想刪除的填答者ID];  -- 例如： id = 3
```

## ✅ TRUNCATE 可以一次清空多張有關聯的表。RESTART IDENTITY 會讓下一次新增資料的 id 從 1 重新開始。CASCADE 則會一併清空所有與 respondents 表有關聯的表（也就是 rankings 表）。

- 這個指令會同時清空 respondents 和 rankings 兩張表的所有資料
- 並且將 ID 計數器重設為 1

```sql
TRUNCATE TABLE respondents RESTART IDENTITY CASCADE;
```
這會：
- 清空資料
- 把自動編號（id）重設回 1
  
---

## 📤 匯出為 CSV 的建議設定（DBeaver）

請使用 DBeaver 匯出結果為 `.csv` 檔時，確認下列設定：

- ✅ **Export column header**：勾選
- ✅ **Quote all values**：勾選
- ✅ **Encoding**：選擇 UTF-8
- ✅ **Insert BOM**：建議勾選（避免中文亂碼）
- ✅ **Delimiter**：使用 `,`
- ✅ **Quote character**：使用 `"`

---

## 📎 建議開啟方式

- 🟢 Excel：請使用「資料 > 自文字匯入」方式開啟，選 UTF-8 編碼
- 🟢 Google Sheets：直接上傳 `.csv` 即可正常辨識

---

如需自動產出圖表或統計分析，請聯絡系統管理者或使用後續的分析腳本進行延伸應用。

