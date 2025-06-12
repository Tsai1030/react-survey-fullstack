const express = require('express');
const cors = require('cors');
const dbPool = require('./db'); // 引入我們的資料庫連線池

const app = express();
const allowedOrigins = [
    'http://localhost:5173', // 允許本地開發的前端
    'https://survey-form-v4mz.onrender.com' // 允許您部署在 Render 上的前端
];

const corsOptions = {
  origin: function (origin, callback) {
    // 如果請求的來源在我們的白名單中，或者請求沒有來源 (例如 Postman)，就允許
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
};

app.use(cors(corsOptions)); // 使用我們自訂的選項
app.use(express.json());
/**
 * 初始化資料庫的函數
 * - 檢查核心資料表是否存在
 * - 如果不存在，就自動建立所有必要的資料表
 */
async function initializeDatabase() {
    const client = await dbPool.connect();
    try {
        // 使用 to_regclass 函數檢查 'respondents' 表是否存在，這是 PostgreSQL 的標準做法
        const checkTableQuery = `SELECT to_regclass('public.respondents');`;
        const res = await client.query(checkTableQuery);
        
        // 如果 to_regclass 返回 null，代表資料表不存在
        if (res.rows[0].to_regclass === null) {
            console.log('📜 資料表 "respondents" 和 "answers" 不存在，正在自動建立...');
            
            // 建立 respondents 表
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
            
            // 建立 answers 表
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
        // 在啟動時如果資料庫初始化失敗，直接讓程式崩潰，方便 Render 自動重試
        process.exit(1); 
    } finally {
        // 無論成功或失敗，都釋放客戶端連線
        client.release();
    }
}


/**
 * API 路由：處理前端提交的問卷資料
 */
app.post('/submit-form', async (req, res) => {
    const { name, gender, education, answers } = req.body;

    // 嚴格的後端驗證
    if (!name || !gender || !education || !answers || Object.keys(answers).length === 0) {
        return res.status(400).json({ message: '缺少必要的表單資料，請填寫完整。' });
    }

    const client = await dbPool.connect();
    try {
        await client.query('BEGIN'); // 開始交易

        // 1. 插入 respondents 並使用 RETURNING id 取回新生成的 id
        const respondentQuery = 'INSERT INTO respondents (name, gender, education) VALUES ($1, $2, $3) RETURNING id';
        const respondentResult = await client.query(respondentQuery, [name, gender, education]);
        const respondentId = respondentResult.rows[0].id;

        console.log(`👨‍💻 已新增填寫者，ID: ${respondentId}`);

        // 2. 準備並插入所有回答
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
        await client.query('ROLLBACK');
        console.error('❌ 資料庫或驗證操作失敗:', error.message);
        
        // 根據錯誤類型回傳不同的狀態碼
        if (error instanceof Error && res.statusCode < 500) {
             res.status(400).json({ message: error.message });
        } else {
             res.status(500).json({ message: '伺服器錯誤，無法儲存問卷，請聯繫管理員。' });
        }
    } finally {
        client.release();
    }
});


/**
 * 啟動伺服器
 */
const PORT = process.env.PORT || 5000;

// 先執行資料庫初始化，成功後再啟動 Express 伺服器
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 後端伺服器正在 http://localhost:${PORT} 上運行`);
    });
}).catch(error => {
    console.error("🔥 無法啟動伺服器，因為資料庫初始化失敗:", error);
    process.exit(1);
});