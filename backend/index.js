const express = require('express');
const cors = require('cors');
const dbPool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/submit-form', async (req, res) => {
    // --- 修改 1：接收新的欄位 ---
    // 從 req.body 中解構出 identity, gender, submissionYear
    const { identity, gender, submissionYear, participationYear, llmFamiliarity, answers } = req.body;



    // --- 修改 2：更新後端驗證邏輯 ---
    // 檢查新的欄位是否都存在
    if (!identity || !gender || !submissionYear || !participationYear || !llmFamiliarity || !answers || Object.keys(answers).length === 0) {
        return res.status(400).json({ message: '缺少必要的表單資料，請填寫完整。' });
    }


    let client;
    try {
        client = await dbPool.connect();
        await client.query('BEGIN');

        // --- 修改 3：更新 SQL 語句和傳入的參數 ---
        // 將 name, education 換成 identity, submission_year
        const respondentQuery = 'INSERT INTO respondents (identity, gender, submission_year, participation_year, llm_familiarity) VALUES ($1, $2, $3, $4, $5) RETURNING id';
        const respondentResult = await client.query(respondentQuery, [identity, gender, submissionYear, participationYear, parseInt(llmFamiliarity)]);
        const respondentId = respondentResult.rows[0].id;

        console.log(`👨‍💻 已新增填寫者，ID: ${respondentId}`);

        // (這個 answers 處理迴圈不需要變動，因為前端 answers 的結構沒變)
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 後端伺服器正在 http://localhost:${PORT} 上運行`);
});
