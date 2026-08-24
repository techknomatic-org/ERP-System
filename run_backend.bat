@echo off
echo ===================================================
echo     Starting FastAPI ERP Backend (Localhost)
echo ===================================================
cd backend
echo Installing Python dependencies...
pip install -r requirements.txt
echo Initializing MySQL database tables and seed data...
python init_db.py
echo Launching FastAPI Server on http://127.0.0.1:8000 ...
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
