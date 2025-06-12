// backend/index.js - 新的 Postgres 版本

const express = require('express');
const cors = require('cors');
const dbPool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/submit-form', async (req, res) => {
    const { name, gender, education, answers } = req.body;

    if (!name || !gender || !education || !answers || Object.keys(answers).length === 0) {
        return res.status(400).json({ message: '缺少必要的表單資料，請填寫完整。' });
    }

    const client = await dbPool.connect(); // 從連線池獲取一個客戶端
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
                                is_preferred === true, // Postgres 可以直接接受布林值
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
        
        await client.query('COMMIT'); // 提交交易
        console.log('👍 交易已成功提交！');

        res.status(200).json({ message: '問卷已成功儲存到資料庫！', respondentId: respondentId });

    } catch (error) {
        await client.query('ROLLBACK'); // 復原交易
        console.error('❌ 資料庫或驗證操作失敗:', error.message);
        res.status(500).json({ message: '伺服器錯誤，無法儲存問卷，請聯繫管理員。' });
    } finally {
        client.release(); // 釋放客戶端回連線池
        console.log('🔗 連線已釋放回連線池。');
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 後端伺服器正在 http://localhost:${PORT} 上運行`);
});