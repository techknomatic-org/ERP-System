# Enterprise ERP - FastAPI + React.js + MySQL Stack

A modern, high-performance Enterprise Resource Planning (ERP) application built with **Python (FastAPI)** for backend API services, **React.js (Vite)** for a reactive frontend user interface, and **MySQL** for relational database management. Designed to run natively on `localhost` without Docker.

---

## 🏗️ Architecture & Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Backend API** | **FastAPI (Python)** | High-performance async REST API with Pydantic validation and Swagger UI (`/docs`) |
| **Database ORM** | **SQLAlchemy + PyMySQL** | Relational ORM mapping Python models to MySQL tables |
| **Frontend UI** | **React.js 18 + Vite** | Component-driven Single Page Application with dynamic glassmorphic design system |
| **Database** | **MySQL Server** | Native relational database (`localhost:3306`) storing users, products, sales, and CRM data |
| **Icons & Style** | **Lucide Icons + SCSS/CSS** | Modern icons and dark/light glassmorphic UI system |

---

## 🚀 Quick Start Guide (Run Locally without Docker)

### Prerequisites
1. **Python 3.10+**: Ensure Python and `pip` are installed on your machine.
2. **Node.js 16+**: Ensure Node.js and `npm` are installed.
3. **MySQL Server**: Ensure local MySQL is running on `localhost:3306` (via MySQL Community Server, XAMPP, or WAMP).

---

### Step 1: Database Setup (MySQL)
Make sure your local MySQL service is running. By default, the app connects using `root` / `root` on `localhost:3306` to database `erp_db`.

You can customize credentials in `backend/.env`:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=erp_db
```

Optionally, manually execute `schema.sql` in MySQL Workbench / Command Line:
```sql
mysql -u root -p < schema.sql
```

---

### Step 2: Run FastAPI Backend
Double-click `run_backend.bat` or run manually in your terminal:
```bash
cd backend
pip install -r requirements.txt
python init_db.py
python -m uvicorn app.main:app --reload --port 8000
```
- **Backend API**: `http://127.0.0.1:8000`
- **Swagger Documentation**: `http://127.0.0.1:8000/docs`

---

### Step 3: Run React.js Frontend
Double-click `run_frontend.bat` or run manually in a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
- **Frontend App**: `http://localhost:5173`

---

## 📁 Project Directory Structure

```
ERP/
├── backend/
│   ├── app/
│   │   ├── api/             # API Routers (dashboard, inventory, sales, customers, system)
│   │   ├── config.py        # Environment settings & MySQL connection URL
│   │   ├── database.py      # SQLAlchemy engine & session maker
│   │   ├── main.py          # FastAPI application entry point with CORS
│   │   ├── models.py        # SQLAlchemy database models
│   │   └── schemas.py       # Pydantic data validation schemas
│   ├── .env.example         # Template environment configuration
│   ├── .env                 # Local environment settings
│   ├── init_db.py           # Auto-creates MySQL tables & seeds sample data
│   └── requirements.txt     # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/      # Sidebar, Navbar, KpiCard
│   │   ├── pages/           # Dashboard, Inventory, Sales, Customers, Settings
│   │   ├── services/        # Axios API client
│   │   ├── App.jsx          # React Router layout
│   │   └── index.css        # Glassmorphic CSS design system
│   ├── package.json         # React dependencies
│   └── vite.config.js       # Vite proxy config pointing to FastAPI backend
├── run_backend.bat          # Windows batch runner for FastAPI backend
├── run_frontend.bat         # Windows batch runner for React frontend
├── schema.sql               # MySQL database schema script
└── README.md                # Local setup guide
```

---

## 🛡️ API Endpoints Summary

- **`GET /api/system/health`**: Returns system status and MySQL connectivity metrics.
- **`GET /api/dashboard/stats`**: Returns executive KPIs (Revenue, Orders, Low Stock Alerts, Customers).
- **`GET /api/inventory/products`**: Lists inventory items.
- **`POST /api/inventory/products`**: Adds new stock item to MySQL.
- **`GET /api/sales/orders`**: Lists all sales orders.
- **`POST /api/sales/orders`**: Creates new sales order and automatically updates inventory stock in MySQL.
- **`GET /api/customers/`**: CRM Customer directory.
- **`POST /api/customers/`**: Adds new customer record.
