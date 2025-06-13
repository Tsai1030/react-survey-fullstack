import os
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.pool import SimpleConnectionPool

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DB_USER = os.getenv("DB_USER")
    DB_PASSWORD = os.getenv("DB_PASSWORD")
    DB_HOST = os.getenv("DB_HOST", "localhost")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DB_NAME = os.getenv("DB_NAME")
    if DB_USER and DB_PASSWORD and DB_NAME:
        DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    else:
        raise RuntimeError("Database configuration is missing")

pool = SimpleConnectionPool(minconn=1, maxconn=10, dsn=DATABASE_URL)

# FastAPI app
app = FastAPI()
allowed_origin = os.getenv("ALLOWED_ORIGIN", "https://survey-form-v4mz.onrender.com")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[allowed_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Answer(BaseModel):
    accuracy: Optional[int] = None
    completeness: Optional[int] = None
    is_preferred: Optional[bool] = False

class FormData(BaseModel):
    name: str
    gender: str
    education: str
    answers: Dict[str, Dict[str, Answer]]

@app.on_event("startup")
def initialize_database():
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT to_regclass('public.respondents');")
            exists = cur.fetchone()[0]
            if exists is None:
                cur.execute(
                    """
                    CREATE TABLE respondents (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        gender VARCHAR(10) NOT NULL,
                        education VARCHAR(50) NOT NULL,
                        submitted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
                cur.execute(
                    """
                    CREATE TABLE answers (
                        id SERIAL PRIMARY KEY,
                        respondent_id INTEGER NOT NULL,
                        question_id INTEGER NOT NULL,
                        model_answer_index INTEGER NOT NULL,
                        accuracy INTEGER,
                        completeness INTEGER,
                        is_preferred BOOLEAN DEFAULT FALSE,
                        CONSTRAINT fk_respondent FOREIGN KEY(respondent_id) REFERENCES respondents(id) ON DELETE CASCADE
                    );
                    """
                )
                conn.commit()
    finally:
        pool.putconn(conn)

@app.post("/submit-form")
def submit_form(data: FormData):
    if not data.answers:
        raise HTTPException(status_code=400, detail="缺少必要的表單資料，請填寫完整。")
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            conn.autocommit = False
            cur.execute(
                "INSERT INTO respondents (name, gender, education) VALUES (%s, %s, %s) RETURNING id",
                (data.name, data.gender, data.education),
            )
            respondent_id = cur.fetchone()[0]
            for qid, ans_dict in data.answers.items():
                if not ans_dict:
                    raise HTTPException(status_code=400, detail=f"問題 {qid} 沒有提供回答。")
                for model_idx, ans in ans_dict.items():
                    if ans.accuracy is None:
                        raise HTTPException(status_code=400, detail=f"問題 {qid} 的模型回答 {int(model_idx)+1} 缺少準確性評分。")
                    cur.execute(
                        "INSERT INTO answers (respondent_id, question_id, model_answer_index, accuracy, completeness, is_preferred) VALUES (%s,%s,%s,%s,%s,%s)",
                        (
                            respondent_id,
                            int(qid),
                            int(model_idx),
                            ans.accuracy,
                            ans.completeness,
                            ans.is_preferred is True,
                        ),
                    )
            conn.commit()
        return {"message": "問卷已成功儲存到資料庫！", "respondentId": respondent_id}
    except HTTPException:
        conn.rollback()
        raise
    except Exception:
        conn.rollback()
        raise HTTPException(status_code=500, detail="伺服器錯誤，無法儲存問卷，請聯繫管理員。")
    finally:
        pool.putconn(conn)
