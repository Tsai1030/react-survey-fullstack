# React Survey Fullstack

This project consists of a React front‑end and a small API server. The original server was implemented with Express. An alternative implementation is now provided using **FastAPI** under `fastapi_backend/`.

## Running the FastAPI server

1. Install Python dependencies:

```bash
pip install -r fastapi_backend/requirements.txt
```

2. Set the required environment variables for connecting to PostgreSQL. Either provide `DATABASE_URL` directly or use `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` and `DB_NAME`.

3. Start the API with:

```bash
npm run api
```

The React application expects the API URL from the `VITE_API_URL` environment variable.
