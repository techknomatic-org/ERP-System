import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database import SessionLocal
from app.models import (
    Project, BOQItem, DetailedEstimate, TechnicalSanction,
    WorkPlan, WBSActivity, BOQWorkPlanMapping, ProjectMember,
    TaskAssignment, ProjectMilestone, SiteLog, MeasurementBook,
    Hindrance, PhysicalProgress, FinancialProgress, ProjectDashboardSummary
)
from sqlalchemy import func

def audit():
    db = SessionLocal()
    try:
        projects = db.query(Project).all()
        print(f"=== Total Projects: {len(projects)} ===")
        for p in projects:
            p_id = p.id
            boqs = db.query(BOQItem).filter(BOQItem.project_id == p_id).count()
            estimates = db.query(DetailedEstimate).filter(DetailedEstimate.project_id == p_id).count()
            sanctions = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == p_id).count()
            workplans = db.query(WorkPlan).filter(WorkPlan.project_id == p_id).count()
            wbs = db.query(WBSActivity).filter(WBSActivity.project_id == p_id).count()
            mappings = db.query(BOQWorkPlanMapping).filter(BOQWorkPlanMapping.project_id == p_id).count()
            members = db.query(ProjectMember).filter(ProjectMember.project_id == p_id).count()
            tasks = db.query(TaskAssignment).filter(TaskAssignment.project_id == p_id).count()
            milestones = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == p_id).count()
            site_logs = db.query(SiteLog).filter(SiteLog.project_id == p_id).count()
            emb = db.query(MeasurementBook).filter(MeasurementBook.project_id == p_id).count()
            hindrances = db.query(Hindrance).filter(Hindrance.project_id == p_id).count()
            phy_prog = db.query(PhysicalProgress).filter(PhysicalProgress.project_id == p_id).count()
            fin_prog = db.query(FinancialProgress).filter(FinancialProgress.project_id == p_id).count()
            dash = db.query(ProjectDashboardSummary).filter(ProjectDashboardSummary.project_id == p_id).count()

            print(f"ID: {p.id:2d} | Code: {p.code:12s} | Status: {p.status:12s} | Name: {p.name}")
            print(f"    BOQ: {boqs} | Est: {estimates} | Sanction: {sanctions} | WP: {workplans} | WBS: {wbs} | Map: {mappings} | Team: {members}")
            print(f"    Tasks: {tasks} | Milestones: {milestones} | Logs: {site_logs} | eMB: {emb} | Hind: {hindrances} | Phys: {phy_prog} | Fin: {fin_prog} | Dash: {dash}")
            print("-" * 80)
    finally:
        db.close()

if __name__ == "__main__":
    audit()
