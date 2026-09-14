import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.database import SessionLocal
from app.models import (
    Project, BoqItem, ProjectEstimate, TechnicalSanction, ContractorAward, WorkOrder,
    WorkPlan, WbsTask, WorkPlanBoqMapping, ProjectTeamMember, TaskAssignment,
    ProjectMilestone, SiteDailyLog, MeasurementBook, Hindrance, NonSorRateAnalysis
)

def audit():
    db = SessionLocal()
    try:
        projects = db.query(Project).all()
        print(f"Total Projects in DB: {len(projects)}")
        for p in projects:
            p_id = p.id
            boqs = db.query(BoqItem).filter(BoqItem.project_id == p_id).count()
            estimates = db.query(ProjectEstimate).filter(ProjectEstimate.project_id == p_id).count()
            sanctions = db.query(TechnicalSanction).filter(TechnicalSanction.project_id == p_id).count()
            awards = db.query(ContractorAward).filter(ContractorAward.project_id == p_id).count()
            orders = db.query(WorkOrder).filter(WorkOrder.project_id == p_id).count()
            workplans = db.query(WorkPlan).filter(WorkPlan.project_id == p_id).count()
            wbs = db.query(WbsTask).filter(WbsTask.project_id == p_id).count()
            mappings = db.query(WorkPlanBoqMapping).filter(WorkPlanBoqMapping.project_id == p_id).count()
            members = db.query(ProjectTeamMember).filter(ProjectTeamMember.project_id == p_id).count()
            tasks = db.query(TaskAssignment).filter(TaskAssignment.project_id == p_id).count()
            milestones = db.query(ProjectMilestone).filter(ProjectMilestone.project_id == p_id).count()
            site_logs = db.query(SiteDailyLog).filter(SiteDailyLog.project_id == p_id).count()
            emb = db.query(MeasurementBook).filter(MeasurementBook.project_id == p_id).count()
            hindrances = db.query(Hindrance).filter(Hindrance.project_id == p_id).count()
            nonsor = db.query(NonSorRateAnalysis).filter(NonSorRateAnalysis.project_id == p_id).count()

            print(f"ID: {p.id:2d} | Code: {p.code:15s} | Status: {p.status:12s} | Active: {getattr(p, 'is_active', 'N/A')} | Name: {p.name}")
            print(f"    BOQ: {boqs} | Est: {estimates} | Sanction: {sanctions} | Award: {awards} | Order: {orders} | WP: {workplans} | WBS: {wbs} | Map: {mappings} | Team: {members}")
            print(f"    Tasks: {tasks} | Milestones: {milestones} | Logs: {site_logs} | eMB: {emb} | Hind: {hindrances} | NonSOR: {nonsor}")
            print("-" * 100)
    finally:
        db.close()

if __name__ == "__main__":
    audit()
