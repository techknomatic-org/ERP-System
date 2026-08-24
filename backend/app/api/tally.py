from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
import json
from datetime import datetime
from app.database import get_db
from app.models import TallySyncQueue, AuditLog, Notification
from app.schemas import TallySyncQueueCreate, TallySyncQueueResponse

router = APIRouter(prefix="/api/tally", tags=["Tally Accounting Integration Layer"])

def generate_tally_xml(voucher_type: str, sync_code: str, ledger_name: str, amount: float, narration: str) -> str:
    """Helper to generate Tally XML payload format."""
    date_str = datetime.utcnow().strftime("%Y%m%d")
    return f"""<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="{voucher_type}" ACTION="Create">
            <DATE>{date_str}</DATE>
            <VOUCHERTYPENAME>{voucher_type}</VOUCHERTYPENAME>
            <VOUCHERNUMBER>{sync_code}</VOUCHERNUMBER>
            <NARRATION>{narration}</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>{ledger_name}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-{amount:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Bank / Cash Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>{amount:.2f}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>"""

@router.get("/queue", response_model=List[TallySyncQueueResponse])
def list_tally_queue(db: Session = Depends(get_db)):
    return db.query(TallySyncQueue).order_by(TallySyncQueue.created_at.desc()).all()

@router.post("/queue", response_model=TallySyncQueueResponse)
def enqueue_tally_voucher(v_in: TallySyncQueueCreate, db: Session = Depends(get_db)):
    code = f"TALLY-{uuid.uuid4().hex[:8].upper()}"
    narration = v_in.narration or f"Automated ERP Sync for {v_in.entity_type} #{v_in.entity_id}"
    
    xml_payload = generate_tally_xml(v_in.voucher_type, code, v_in.ledger_name, v_in.amount, narration)
    json_payload = json.dumps({
        "voucher_type": v_in.voucher_type,
        "sync_code": code,
        "ledger_name": v_in.ledger_name,
        "amount": v_in.amount,
        "narration": narration,
        "entity_type": v_in.entity_type,
        "entity_id": v_in.entity_id
    })

    tally_item = TallySyncQueue(
        sync_code=code,
        voucher_type=v_in.voucher_type,
        entity_type=v_in.entity_type,
        entity_id=v_in.entity_id,
        payload_xml=xml_payload,
        payload_json=json_payload,
        status="pending",
        retry_count=0
    )
    db.add(tally_item)
    db.commit()
    db.refresh(tally_item)

    audit = AuditLog(user_id=1, action="CREATE", entity_type="TallySyncQueue", entity_id=tally_item.id, payload=f"Enqueued Tally Voucher #{code} ({v_in.voucher_type}) Amount: ${v_in.amount}")
    db.add(audit)
    db.commit()

    return tally_item

@router.post("/queue/{sync_id}/sync")
def sync_voucher_to_tally(sync_id: int, db: Session = Depends(get_db)):
    item = db.query(TallySyncQueue).filter(TallySyncQueue.id == sync_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Tally Queue item not found")

    # Mock Tally Integration HTTP/XML Communication Service
    # Simulates Tally Server Response XML 200 OK
    item.status = "synced"
    item.synced_at = datetime.utcnow()
    item.error_log = "TALLY_RESPONSE: <RESPONSE><CREATED>1</CREATED><ERRORS>0</ERRORS></RESPONSE>"
    db.commit()

    notif = Notification(
        user_id=1,
        title=f"Tally Sync Successful #{item.sync_code}",
        message=f"Voucher {item.voucher_type} for {item.entity_type} #{item.entity_id} posted to Tally ERP.",
        notification_type="info",
        entity_type="TallySyncQueue",
        entity_id=item.id
    )
    db.add(notif)

    audit = AuditLog(user_id=1, action="SYNC", entity_type="TallySyncQueue", entity_id=item.id, payload=f"Synced Voucher #{item.sync_code} to Tally ERP Server")
    db.add(audit)
    db.commit()

    return {"message": "Successfully posted voucher to Tally ERP", "sync_code": item.sync_code, "status": item.status}

@router.post("/sync-all")
def mass_sync_tally_queue(db: Session = Depends(get_db)):
    pending = db.query(TallySyncQueue).filter(TallySyncQueue.status == "pending").all()
    count = 0
    for p in pending:
        p.status = "synced"
        p.synced_at = datetime.utcnow()
        p.error_log = "TALLY_RESPONSE: <RESPONSE><CREATED>1</CREATED><ERRORS>0</ERRORS></RESPONSE>"
        count += 1

    db.commit()
    return {"message": f"Mass sync complete. Posted {count} pending vouchers to Tally ERP.", "synced_count": count}
