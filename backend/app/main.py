import os
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

os.makedirs("uploads", exist_ok=True)
os.makedirs("uploads/site_photos", exist_ok=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="FastAPI Backend for Enterprise Real Estate & Construction ERP System"
)

from app.db_initializer import auto_init_db

@app.on_event("startup")
def startup_event():
    """Run database auto-initialization & column migrations on server startup."""
    try:
        auto_init_db()
    except Exception as e:
        print(f"[Startup Error] Automatic DB initialization note: {e}")

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
from app.api import (
    dashboard, inventory, sales, customers, system, auth, 
    notifications, approvals, audit, documents,
    properties, buildings, units, crm_leads, bookings, payments, portal,
    projects, wbs, site_logs,
    vendors, boq_mb, contractor_billing,
    hse, quality, facility, tally, ai_analytics,
    schedule_of_rates, estimation, contractor_awards, work_orders, work_plans, task_assignments, project_teams, non_sor, technical_sanctions,
    milestones, hindrances, mobile
)




ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:8021",
    "http://139.59.29.162:8021",
    "http://139.59.29.162:8102",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core Routers
app.include_router(system.router)
app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(customers.router)
app.include_router(notifications.router)
app.include_router(approvals.router)
app.include_router(audit.router)
app.include_router(documents.router)

# Phase 2 Routers
app.include_router(properties.router)
app.include_router(buildings.router)
app.include_router(units.router)
app.include_router(crm_leads.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(portal.router)

# Phase 3 Routers
app.include_router(projects.router)
app.include_router(wbs.router)
app.include_router(site_logs.router)

# Phase 4 Routers
app.include_router(vendors.router)
app.include_router(boq_mb.router)
app.include_router(contractor_billing.router)

# Phase 5 Routers
app.include_router(hse.router)
app.include_router(quality.router)

# Phase 6 Router
app.include_router(facility.router)

# Phase 7 Router
app.include_router(tally.router)

# Phase 8 Router
app.include_router(ai_analytics.router)

# SOR Router
app.include_router(schedule_of_rates.router)

# Non-SOR Rate Analysis Router (PSC-06)
app.include_router(non_sor.router)

# Estimation Router
app.include_router(estimation.router)

# Contractor Award Router
app.include_router(contractor_awards.router)

# Work Order Router
app.include_router(work_orders.router)

# Work Plan Router
app.include_router(work_plans.router)

# Task Assignments Router
app.include_router(task_assignments.router)

# Project Teams Router
app.include_router(project_teams.router)

# Technical Sanction Router (PSC-07)
app.include_router(technical_sanctions.router)

# Milestone Definition Router (WPT-03)
app.include_router(milestones.router)

# Hindrance Logging & EE Decision Router (EXA-06)
app.include_router(hindrances.router)

# Mobile App Router (INT-05)
app.include_router(mobile.router)



@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "docs_url": "/docs",
        "status": "active"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
