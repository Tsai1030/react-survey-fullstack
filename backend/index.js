const express = require('express');
const cors = require('cors');
const dbPool = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/submit-form', async (req, res) => {
    // --- 修改 1：接收新的欄位，將 answers 換成 rankings ---
    const { identity, gender, submissionYear, participationYear, llmFamiliarity, rankings } = req.body;

    // --- 修改 2：更新後端驗證邏輯 ---
    // 檢查新的欄位是否都存在
    if (!identity || !gender || !submissionYear || !participationYear || !llmFamiliarity || !rankings || Object.keys(rankings).length === 0) {
        return res.status(400).json({ message: '缺少必要的表單資料，請填寫完整。' });
    }

    let client;
    try {
        client = await dbPool.connect();
        await client.query('BEGIN'); // 開始資料庫交易

        // 這部分不變：先將填答者基本資料存入 respondents 表
        const respondentQuery = 'INSERT INTO respondents (identity, gender, submission_year, participation_year, llm_familiarity) VALUES ($1, $2, $3, $4, $5) RETURNING id';
        const respondentResult = await client.query(respondentQuery, [identity, gender, submissionYear, participationYear, parseInt(llmFamiliarity)]);
        const respondentId = respondentResult.rows[0].id;

        console.log(`👨‍💻 已新增填寫者，ID: ${respondentId}`);

        // --- 修改 3：處理 rankings 資料的迴圈 ---
        const rankingPromises = [];
        // 遍歷 rankings 物件，其中 key 是 questionId，value 是排序後的答案索引陣列 e.g., [2, 0, 1]
        for (const questionId in rankings) {
            if (Object.hasOwnProperty.call(rankings, questionId)) {
                
                const rankedOrderArray = rankings[questionId]; // e.g., [2, 0, 1]

                if (!Array.isArray(rankedOrderArray) || rankedOrderArray.length === 0) {
                    throw new Error(`問題 ${questionId} 的排序資料格式不正確。`);
                }

                // 再次遍歷排序陣列，將每一筆排序存入資料庫
                // rankIndex 是 0, 1, 2，代表名次
                // modelAnswerIndex 是陣列中的值，代表原始答案的索引
                rankedOrderArray.forEach((modelAnswerIndex, rankIndex) => {
                    const rank = rankIndex + 1; // 排名從 1 開始 (第1名, 第2名...)

                    const rankingQuery = 'INSERT INTO rankings (respondent_id, question_id, model_answer_index, rank) VALUES ($1, $2, $3, $4)';
                    
                    rankingPromises.push(
                        client.query(rankingQuery, [
                            respondentId,
                            parseInt(questionId),
                            parseInt(modelAnswerIndex),
                            rank,
                        ])
                    );
                });
            }
        }
        
        if (rankingPromises.length === 0) {
             throw new Error('沒有有效的排序資料可以儲存。');
        }

        // 使用 Promise.all 一次性執行所有 INSERT 操作
        await Promise.all(rankingPromises);
        console.log(`📝 已新增 ${rankingPromises.length} 筆排序記錄到資料庫。`);

        await client.query('COMMIT'); // 提交交易
        console.log('👍 交易已成功提交！');

        res.status(200).json({ message: '問卷已成功儲存到資料庫！', respondentId: respondentId });

    } catch (error) {
        if (client) {
            await client.query('ROLLBACK'); // 如果發生錯誤，回滾交易
        }
        
        console.error('❌ 資料庫或驗證操作失敗:', error.message);
        // 根據錯誤類型回傳不同的狀態碼
        if (error instanceof Error && !res.headersSent) {
             res.status(400).json({ message: error.message });
        } else if (!res.headersSent) {
             res.status(500).json({ message: '伺服器錯誤，無法儲存問卷，請聯繫管理員。' });
        }

    } finally {
        if (client) {
            client.release(); // 釋放資料庫連接
        }
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 後端伺服器正在 http://localhost:${PORT} 上運行`);
});
