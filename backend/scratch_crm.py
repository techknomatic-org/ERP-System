from app.database import SessionLocal
from app.models import CrmLead, CrmLeadActivity, CrmFollowup, CrmSiteVisit, Property, Project, User
from datetime import datetime, timedelta

def seed_crm():
    db = SessionLocal()
    try:
        proj = db.query(Project).filter(Project.code == "PROJ-GREENFIELD").first()
        prop = db.query(Property).filter(Property.code == "PROP-GREENFIELD").first()
        admin = db.query(User).filter(User.username == "admin").first()

        proj_id = proj.id if proj else None
        prop_id = prop.id if prop else None
        admin_id = admin.id if admin else 1

        l1 = db.query(CrmLead).filter(CrmLead.email == "contact@abccorp.com").first()
        if not l1:
            l1 = CrmLead(
                customer_name="ABC Corporation",
                company="ABC Corporation",
                email="contact@abccorp.com",
                phone="+1-555-0199",
                source="Website",
                stage="QUALIFIED",
                lead_type="Corporate",
                priority="High",
                project_id=proj_id,
                property_id=prop_id,
                preferred_unit_type="Corporate Office",
                budget=650000.0,
                requirement="Corporate office space floor 5",
                requirement_confirmed=True,
                budget_available=True,
                decision_maker_identified=True,
                qualification_notes="Budget verified and decision maker identified."
            )
            db.add(l1)
            db.commit()
            db.refresh(l1)

            act1 = CrmLeadActivity(lead_id=l1.id, activity_type="CREATE", description="Lead created via Website Form")
            act2 = CrmLeadActivity(lead_id=l1.id, activity_type="QUALIFIED", description="Lead qualified: Requirement & budget verified")
            db.add_all([act1, act2])
            db.commit()

        l2 = db.query(CrmLead).filter(CrmLead.email == "info@xyzenterprises.com").first()
        if not l2:
            l2 = CrmLead(
                customer_name="XYZ Enterprises",
                company="XYZ Enterprises",
                email="info@xyzenterprises.com",
                phone="+1-555-0288",
                source="Referral",
                stage="SITE_VISIT",
                lead_type="Corporate",
                priority="Critical",
                project_id=proj_id,
                property_id=prop_id,
                preferred_unit_type="Retail Shop",
                budget=850000.0,
                requirement="Ground floor high-street retail store"
            )
            db.add(l2)
            db.commit()
            db.refresh(l2)

            act3 = CrmLeadActivity(lead_id=l2.id, activity_type="CREATE", description="Lead created via Executive Referral")
            act4 = CrmLeadActivity(lead_id=l2.id, activity_type="SITE_VISIT_SCHEDULED", description="Site Visit scheduled for Greenfield Business Complex")
            db.add_all([act3, act4])

            sv = CrmSiteVisit(
                lead_id=l2.id,
                property_id=prop_id,
                visit_date=datetime.utcnow() + timedelta(days=2),
                assigned_executive_id=admin_id,
                status="Scheduled",
                interest_level="High",
                notes="Customer wants to tour Ground Floor Retail Units."
            )
            db.add(sv)
            db.commit()

        l3 = db.query(CrmLead).filter(CrmLead.email == "sales@apexglobal.com").first()
        if not l3:
            l3 = CrmLead(
                customer_name="Apex Global Holding",
                company="Apex Global Holding",
                email="sales@apexglobal.com",
                phone="+1-555-0377",
                source="Walk-in",
                stage="NEW",
                lead_type="Corporate",
                priority="Medium",
                project_id=proj_id,
                property_id=prop_id,
                preferred_unit_type="Corporate Office",
                budget=1200000.0,
                requirement="Looking for top floor executive suite"
            )
            db.add(l3)
            db.commit()

        print("[+] Story 4 sample CRM leads seeded successfully in MySQL!")
    except Exception as e:
        db.rollback()
        print("[-] Error seeding CRM:", e)
    finally:
        db.close()

if __name__ == "__main__":
    seed_crm()
