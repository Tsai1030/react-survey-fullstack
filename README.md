### render 表單網址

https://form-frontend-u3x9.onrender.com/

## SQL查詢總表單

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
