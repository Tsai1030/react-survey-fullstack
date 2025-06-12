const express = require('express');
const cors = require('cors');
const dbPool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/submit-form', async (req, res) => {
    const { name, gender, education, answers } = req.body;

    // 恢復嚴格的後端驗證
    if (!name || !gender || !education || !answers || Object.keys(answers).length === 0) {
        return res.status(400).json({ message: '缺少必要的表單資料，請填寫完整。' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        const respondentQuery = 'INSERT INTO respondents (name, gender, education) VALUES (?, ?, ?)';
        const [respondentResult] = await connection.execute(respondentQuery, [name, gender, education]);
        const respondentId = respondentResult.insertId;

        console.log(`👨‍💻 已新增填寫者，ID: ${respondentId}`);

        const answerPromises = [];
        for (const questionId in answers) {
            if (Object.hasOwnProperty.call(answers, questionId)) {
                // 檢查是否所有問題都有回答
                if (!answers[questionId] || Object.keys(answers[questionId]).length === 0) {
                    throw new Error(`問題 ${questionId} 沒有提供回答。`);
                }
                for (const modelAnswerIndex in answers[questionId]) {
                    if (Object.hasOwnProperty.call(answers[questionId], modelAnswerIndex)) {
                        const answerData = answers[questionId][modelAnswerIndex];
                        
                        // 檢查準確性是否都有填
                        if (!answerData || !answerData.accuracy) {
                            throw new Error(`問題 ${questionId} 的模型回答 ${parseInt(modelAnswerIndex) + 1} 缺少準確性評分。`);
                        }

                        // 從 answerData 中解構出 is_preferred
                        const { accuracy, completeness, is_preferred } = answerData;
                        
                        // 在 SQL 語句和參數中加入 is_preferred
                        const answerQuery = 'INSERT INTO answers (respondent_id, question_id, model_answer_index, accuracy, completeness, is_preferred) VALUES (?, ?, ?, ?, ?, ?)';
                        
                        answerPromises.push(
                            connection.execute(answerQuery, [
                                respondentId,
                                parseInt(questionId),
                                parseInt(modelAnswerIndex),
                                accuracy ? parseInt(accuracy) : null,
                                completeness ? parseInt(completeness) : null,
                                is_preferred === true ? 1 : 0, // 將布林值 true/false 轉換成 1/0
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
        
        await connection.commit();
        console.log('👍 交易已成功提交！');

        res.status(200).json({ message: '問卷已成功儲存到資料庫！', respondentId: respondentId });

    } catch (error) {
        if (connection) {
            await connection.rollback();
        }
        
        console.error('❌ 資料庫或驗證操作失敗:', error.message);
        // 如果是我們自訂的驗證錯誤，就回傳它的訊息
        // 否則回傳通用的伺服器錯誤訊息
        if (error instanceof Error && res.statusCode < 500) {
             res.status(400).json({ message: error.message });
        } else {
             res.status(500).json({ message: '伺服器錯誤，無法儲存問卷，請聯繫管理員。' });
        }

    } finally {
        if (connection) {
            connection.release();
        }
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 後端伺服器正在 http://localhost:${PORT} 上運行`);
});