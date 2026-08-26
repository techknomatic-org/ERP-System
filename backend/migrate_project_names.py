import sys
from sqlalchemy import text

sys.path.append(r'c:\Users\khushi.gurave\Desktop\ERP\backend')
from app.database import engine

def run_migration():
    print("=== STARTING MYSQL DATABASE PROJECT RENAMING MIGRATION ===")
    with engine.begin() as conn:
        # 1. Update projects table
        print("[1/8] Updating projects table...")
        conn.execute(text("""
            UPDATE projects 
            SET name = 'Riverside Commercial Complex – Phase 1', code = 'PROJ-RIVERSIDE'
            WHERE code = 'PRJ-SCT-01' OR code = 'PROJ-RIVERSIDE' OR name LIKE '%Skyline Commercial%'
        """))
        
        conn.execute(text("""
            UPDATE projects 
            SET name = 'Greenfield Business Park', code = 'PROJ-GREENFIELD'
            WHERE code = 'PROJ-SKYLINE' OR code = 'PROJ-GREENFIELD' OR name LIKE '%Skyline Business%'
        """))

        # 2. Update properties table
        print("[2/8] Updating properties table...")
        conn.execute(text("""
            UPDATE properties 
            SET name = 'Greenfield Business Complex', code = 'PROP-GREENFIELD'
            WHERE id = 3 OR code = 'PROP-SKYLINE'
        """))
        conn.execute(text("""
            UPDATE properties 
            SET name = 'Greenfield Business Towers', code = 'PROP-GBT'
            WHERE id = 1 OR code = 'PROP-SBT'
        """))

        # 3. Update buildings table
        print("[3/8] Updating buildings table...")
        conn.execute(text("""
            UPDATE buildings 
            SET name = 'Greenfield Tower A', code = 'BLD-GREENFIELD-A'
            WHERE id = 3 OR code = 'BLD-TOWER-A' OR name LIKE '%Skyline Tower A%'
        """))
        conn.execute(text("""
            UPDATE buildings 
            SET name = 'Greenfield Tower B', code = 'BLD-GREENFIELD-B'
            WHERE id = 4 OR code = 'BLD-TOWER-B' OR name LIKE '%Skyline Tower B%'
        """))

        # 4. Update approval_tasks table titles
        print("[4/8] Updating approval_tasks titles...")
        conn.execute(text("""
            UPDATE approval_tasks 
            SET title = REPLACE(title, 'Skyline Business Tower', 'Greenfield Business Park')
            WHERE title LIKE '%Skyline Business Tower%'
        """))
        conn.execute(text("""
            UPDATE approval_tasks 
            SET title = REPLACE(title, 'Skyline Commercial Tower - Phase 1 Construction', 'Riverside Commercial Complex – Phase 1')
            WHERE title LIKE '%Skyline Commercial Tower - Phase 1 Construction%'
        """))
        conn.execute(text("""
            UPDATE approval_tasks 
            SET title = REPLACE(title, 'Skyline Commercial Tower', 'Riverside Commercial Complex – Phase 1')
            WHERE title LIKE '%Skyline Commercial Tower%'
        """))

        # 5. Update notifications table titles and messages
        print("[5/8] Updating notifications table...")
        conn.execute(text("""
            UPDATE notifications 
            SET title = REPLACE(title, 'Skyline Business Tower', 'Greenfield Business Park')
            WHERE title LIKE '%Skyline Business Tower%'
        """))
        conn.execute(text("""
            UPDATE notifications 
            SET title = REPLACE(title, 'Skyline Commercial Tower - Phase 1 Construction', 'Riverside Commercial Complex – Phase 1')
            WHERE title LIKE '%Skyline Commercial Tower - Phase 1 Construction%'
        """))
        conn.execute(text("""
            UPDATE notifications 
            SET title = REPLACE(title, 'Skyline Commercial Tower', 'Riverside Commercial Complex – Phase 1')
            WHERE title LIKE '%Skyline Commercial Tower%'
        """))
        conn.execute(text("""
            UPDATE notifications 
            SET message = REPLACE(message, 'Skyline Business Tower', 'Greenfield Business Park')
            WHERE message LIKE '%Skyline Business Tower%'
        """))
        conn.execute(text("""
            UPDATE notifications 
            SET message = REPLACE(message, 'Skyline Commercial Tower', 'Riverside Commercial Complex – Phase 1')
            WHERE message LIKE '%Skyline Commercial Tower%'
        """))

        # 6. Update crm_lead_activities descriptions
        print("[6/8] Updating crm_lead_activities descriptions...")
        conn.execute(text("""
            UPDATE crm_lead_activities 
            SET description = REPLACE(description, 'Skyline Business Complex', 'Greenfield Business Complex')
            WHERE description LIKE '%Skyline Business Complex%'
        """))
        conn.execute(text("""
            UPDATE crm_lead_activities 
            SET description = REPLACE(description, 'Skyline Business Tower', 'Greenfield Business Park')
            WHERE description LIKE '%Skyline Business Tower%'
        """))

        # 7. Update ocr_documents JSON extracted data
        print("[7/8] Updating ocr_documents JSON text...")
        conn.execute(text("""
            UPDATE ocr_documents 
            SET extracted_data_json = REPLACE(extracted_data_json, 'Skyline Commercial Tower - Phase 1 Construction', 'Riverside Commercial Complex – Phase 1')
            WHERE extracted_data_json LIKE '%Skyline Commercial Tower - Phase 1 Construction%'
        """))
        conn.execute(text("""
            UPDATE ocr_documents 
            SET extracted_data_json = REPLACE(extracted_data_json, 'Skyline Commercial Tower', 'Riverside Commercial Complex – Phase 1')
            WHERE extracted_data_json LIKE '%Skyline Commercial Tower%'
        """))

        # 8. Update audit_logs payload
        print("[8/8] Updating audit_logs payload...")
        conn.execute(text("""
            UPDATE audit_logs 
            SET payload = REPLACE(payload, 'Skyline Business Tower', 'Greenfield Business Park')
            WHERE payload LIKE '%Skyline Business Tower%'
        """))
        conn.execute(text("""
            UPDATE audit_logs 
            SET payload = REPLACE(payload, 'Skyline Commercial Tower - Phase 1 Construction', 'Riverside Commercial Complex – Phase 1')
            WHERE payload LIKE '%Skyline Commercial Tower%'
        """))
        conn.execute(text("""
            UPDATE audit_logs 
            SET payload = REPLACE(payload, 'PROJ-SKYLINE', 'PROJ-GREENFIELD')
            WHERE payload LIKE '%PROJ-SKYLINE%'
        """))
        conn.execute(text("""
            UPDATE audit_logs 
            SET payload = REPLACE(payload, 'PRJ-SCT-01', 'PROJ-RIVERSIDE')
            WHERE payload LIKE '%PRJ-SCT-01%'
        """))

    print("=== MYSQL MIGRATION EXECUTED SUCCESSFULLY ===")

if __name__ == "__main__":
    run_migration()
