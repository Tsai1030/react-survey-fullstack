const express = require('express');
const cors = require('cors');
const dbPool = require('./db'); // 引入我們的資料庫連線池

const app = express();

// --- ⚠️ 最終、最完整的 CORS 設定 ---
// 建立一個允許的來源白名單
const allowedOrigins = [
    'http://localhost:5173',                 // 允許本地開發的前端
    'https://survey-form-v4mz.onrender.com'  // 允許您部署在 Render 上的前端
];

// 建立一個 CORS 選項物件
const corsOptions = {
  origin: function (origin, callback) {
    // 檢查請求的來源是否在我們的白名單中
    // !origin 的判斷是為了允許像 Postman 這種沒有來源的請求
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true); // 允許請求
    } else {
      callback(new Error('Not allowed by CORS')); // 拒絕請求
    }
  },
  methods: "GET,POST,PUT,DELETE,PATCH,OPTIONS", // 明確允許的方法
  credentials: true
};

// 在所有路由之前，特別處理 OPTIONS 預檢請求
app.options('*', cors(corsOptions)); 

// 為所有後續路由啟用我們自訂的 CORS 設定
app.use(cors(corsOptions));

// 讓 Express 能夠解析傳入請求的 JSON 格式的 body
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
        // 如果連線存在，就復原交易
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
        // 如果連線存在，就釋放回連線池
        if (client) {
            client.release();
        }
    }
});


/**
 * 啟動伺服器
 */
const PORT = process.env.PORT || 10000; // Render 預設使用 10000 埠

// 先執行資料庫初始化，成功後再啟動 Express 伺服器
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 後端伺服器正在 http://localhost:${PORT} 上運行`);
    });
}).catch(error => {
    console.error("🔥 無法啟動伺服器，因為資料庫初始化失敗:", error);
    process.exit(1);
});