@echo off
echo ===================================================
echo     Starting React.js ERP Frontend (Vite)
echo ===================================================
cd frontend
echo Installing npm packages...
npm install
echo Launching React Dev Server on http://localhost:5173 ...
npm run dev
pause
