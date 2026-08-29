# Deploying AuditFlow Backend on Render

This backend is pre-configured for deployment as a **Web Service** on [Render](https://render.com).

---

## Method 1: 1-Click Deploy via Render Blueprint (Recommended)

1. Push your repository to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com).
3. Click **New +** -> **Blueprint**.
4. Select your GitHub repository.
5. Render will automatically read `render.yaml` and configure:
   - **Service Type**: Web Service
   - **Runtime**: Python 3.12.8
   - **Root Directory**: `backend`
   - **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Health Check**: `/health`
6. In the prompt for `DATABASE_URL`, paste your **Supabase PostgreSQL connection string**:
   ```
   postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```
7. Click **Apply**. Render will build and deploy your API!

---

## Method 2: Manual Web Service Setup on Render

1. On [dashboard.render.com](https://dashboard.render.com), click **New +** -> **Web Service**.
2. Connect your GitHub repository.
3. Fill in the following settings:
   - **Name**: `auditflow-backend`
   - **Language**: `Python 3`
   - **Root Directory**: `backend`
   - **Build Command**: `pip install --upgrade pip && pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Under **Environment Variables**, add:
   - `DATABASE_URL`: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - `PYTHON_VERSION`: `3.12.8`
   - `ENVIRONMENT`: `production`
5. Under **Advanced**:
   - **Health Check Path**: `/health`
6. Click **Create Web Service**.

---

## Verification After Deployment

Once the deploy completes, test your live service URL:
- **Health check**: `https://your-app-name.onrender.com/health`
- **Database status**: `https://your-app-name.onrender.com/api/v1/health/db`
- **API Documentation**: `https://your-app-name.onrender.com/docs`
