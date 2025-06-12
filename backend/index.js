const express = require('express');
const cors = require('cors'); // 我們仍然需要它來處理 OPTIONS 請求
const dbPool = require('./db');

const app = express();

// --- ⚠️ 終極、手動的 CORS 設定中介軟體 ---
app.use((req, res, next) => {
  // 您的前端部署網址
  const allowedOrigin = 'https://survey-form-v4mz.onrender.com';
  
  // 為所有回應都強制加上這個標頭
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  
  // 允許的請求方法
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  
  // 允許的請求標頭，特別是 Content-Type
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  
  // 允許傳送 cookies (雖然目前沒用到，但加上無妨)
  res.setHeader('Access-Control-Allow-Credentials', true);

  // 如果進來的請求是 OPTIONS (預檢請求)，我們就直接回傳 204 並結束，不讓它往下走
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  
  // 如果不是 OPTIONS 請求，就讓它繼續往下一個中介軟體或路由處理器
  next();
});

// 在 CORS 設定之後，才解析 JSON body
app.use(express.json());


/**
 * 初始化資料庫的函數
 */
async function initializeDatabase() {
    const client = await dbPool.connect();
    try {
        const checkTableQuery = `SELECT to_regclass('public.respondents');`;
        const res = await client.query(checkTableQuery);
        
        if (res.rows[0].to_regclass === null) {
            console.log('📜 資料表 "respondents" 和 "answers" 不存在，正在自動建立...');
            
            const createRespondentsTable = `
                CREATE TABLE respondents (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    gender VARCHAR(10) NOT NULL,
                    education VARCHAR(50) NOT NULL,
                    submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            `;
            await client.query(createRespondentsTable);
            console.log('✅ 資料表 "respondents" 建立成功！');
            
            const createAnswersTable = `
                CREATE TABLE answers (
                    id SERIAL PRIMARY KEY,
                    respondent_id INTEGER NOT NULL,
                    question_id INTEGER NOT NULL,
                    model_answer_index INTEGER NOT NULL,
                    accuracy INTEGER,
                    completeness INTEGER,
                    is_preferred BOOLEAN DEFAULT FALSE,
                    CONSTRAINT fk_respondent
                        FOREIGN KEY(respondent_id) 
                        REFERENCES respondents(id)
                        ON DELETE CASCADE
                );
            `;
            await client.query(createAnswersTable);
            console.log('✅ 資料表 "answers" 建立成功！');
            
        } else {
            console.log('👍 資料表已存在，無需建立。');
        }
    } catch (err) {
        console.error('❌ 初始化資料庫失敗:', err);
        process.exit(1); 
    } finally {
        client.release();
    }
}


/**
 * API 路由：處理前端提交的問卷資料
 */
app.post('/submit-form', async (req, res) => {
    const { name, gender, education, answers } = req.body;

    if (!name || !gender || !education || !answers || Object.keys(answers).length === 0) {
        return res.status(400).json({ message: '缺少必要的表單資料，請填寫完整。' });
    }

    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');

        const respondentQuery = 'INSERT INTO respondents (name, gender, education) VALUES ($1, $2, $3) RETURNING id';
        const respondentResult = await client.query(respondentQuery, [name, gender, education]);
        const respondentId = respondentResult.rows[0].id;

        console.log(`👨‍💻 已新增填寫者，ID: ${respondentId}`);

        const answerPromises = [];
        for (const questionId in answers) {
            if (Object.hasOwnProperty.call(answers, questionId)) {
                if (!answers[questionId] || Object.keys(answers[questionId]).length === 0) {
                    throw new Error(`問題 ${questionId} 沒有提供回答。`);
                }
                for (const modelAnswerIndex in answers[questionId]) {
                    if (Object.hasOwnProperty.call(answers[questionId], modelAnswerIndex)) {
                        const answerData = answers[questionId][modelAnswerIndex];
                        if (!answerData || !answerData.accuracy) {
                            throw new Error(`問題 ${questionId} 的模型回答 ${parseInt(modelAnswerIndex) + 1} 缺少準確性評分。`);
                        }
                        const { accuracy, completeness, is_preferred } = answerData;
                        const answerQuery = 'INSERT INTO answers (respondent_id, question_id, model_answer_index, accuracy, completeness, is_preferred) VALUES ($1, $2, $3, $4, $5, $6)';
                        answerPromises.push(
                            client.query(answerQuery, [
                                respondentId,
                                parseInt(questionId),
                                parseInt(modelAnswerIndex),
                                accuracy ? parseInt(accuracy) : null,
                                completeness ? parseInt(completeness) : null,
                                is_preferred === true,
                            ])
                        );
                    }
                }
            }
        }

        if (answerPromises.length === 0) {
             throw new Error('沒有有效的回答資料可以儲存。');
        }

        await Promise.all(answerPromises);
        console.log(`📝 已新增 ${answerPromises.length} 筆回答到資料庫。`);
        
        await client.query('COMMIT');
        console.log('👍 交易已成功提交！');

        res.status(200).json({ message: '問卷已成功儲存到資料庫！', respondentId: respondentId });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK');
        }
        console.error('❌ 資料庫或驗證操作失敗:', error.message);
        
        if (error instanceof Error && res.statusCode < 500) {
             res.status(400).json({ message: error.message });
        } else {
             res.status(500).json({ message: '伺服器錯誤，無法儲存問卷，請聯繫管理員。' });
        }
    } finally {
        if (client) {
            client.release();
        }
    }
});


/**
 * 啟動伺服器
 */
const PORT = process.env.PORT || 10000;

initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 後端伺服器正在 http://localhost:${PORT} 上運行`);
    });
}).catch(error => {
    console.error("🔥 無法啟動伺服器，因為資料庫初始化失敗:", error);
    process.exit(1);
});