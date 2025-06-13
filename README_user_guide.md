### Render 表單網址

https://form-frontend-u3x9.onrender.com/


# 📊 問卷資料庫查詢與匯出說明

本專案使用 PostgreSQL 資料庫儲存問卷填寫結果，以下提供常用查詢語法與匯出說明，方便進行資料分析或備份。

---

## 📌 資料表結構

### respondents（填寫者資訊）

| 欄位名稱      | 型別         | 說明       |
|---------------|--------------|------------|
| id            | SERIAL       | 主鍵，自動編號 |
| name          | TEXT         | 填寫者姓名 |
| gender        | TEXT         | 性別       |
| education     | TEXT         | 教育程度   |
| created_at    | TIMESTAMP    | 填寫時間（預設為當前時間） |

### answers（問卷回答）

| 欄位名稱           | 型別      | 說明 |
|--------------------|-----------|------|
| id                 | SERIAL    | 主鍵 |
| respondent_id      | INTEGER   | 對應 respondents.id |
| question_id        | INTEGER   | 問題編號 |
| model_answer_index | INTEGER   | 第幾個模型回答（0,1,2） |
| accuracy           | INTEGER   | 準確性評分 |
| completeness       | INTEGER   | 完整性評分 |
| is_preferred       | BOOLEAN   | 是否為偏好答案 |

---

## 📄 常用 SQL 查詢語法

### 查詢所有填寫者及其對每題模型回答的評分與偏好

```sql
SELECT  
  r.name,
  r.gender,
  r.education,
  a.id AS answer_id,
  a.question_id,
  a.model_answer_index,
  a.accuracy,
  a.completeness,
  r.id AS respondent_id,
  r.created_at AS submitted_at
FROM answers AS a
LEFT JOIN respondents AS r ON a.respondent_id = r.id
ORDER BY r.id, a.question_id;
```

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

