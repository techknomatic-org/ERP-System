import sys
import os

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi import HTTPException
from app.api.boq_mb import validate_dimensions

def test_dimensions():
    print("--- TESTING EXA-02 STRUCTURED DIMENSION CALCULATION ---")
    
    # 1. L=10, B=5, H=2 -> 100
    res1 = validate_dimensions("LBH", 10.00, 5.00, 2.00, None)
    assert res1 == 100.0, f"Expected 100.0, got {res1}"
    print(f"PASS: L=10.00, B=5.00, H=2.00 -> {res1}")

    # 2. L=10.5, B=2, H=3 -> 63
    res2 = validate_dimensions("LBH", 10.5, 2, 3, None)
    assert res2 == 63.0, f"Expected 63.0, got {res2}"
    print(f"PASS: L=10.5, B=2, H=3 -> {res2}")

    # 3. Direct Quantity = 100 -> 100
    res3 = validate_dimensions("DIRECT", None, None, None, 100)
    assert res3 == 100.0, f"Expected 100.0, got {res3}"
    print(f"PASS: DIRECT dq=100 -> {res3}")

    # 4. Empty length -> HTTP 400
    try:
        validate_dimensions("LBH", "", 5, 2, None)
        assert False, "Should have raised HTTPException"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"PASS: Empty length rejected with detail: {e.detail}")

    # 5. Non-numeric value -> HTTP 400
    try:
        validate_dimensions("LBH", "abc", 5, 2, None)
        assert False, "Should have raised HTTPException"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"PASS: Non-numeric length rejected with detail: {e.detail}")

    # 6. Zero value -> HTTP 400
    try:
        validate_dimensions("LBH", 0, 5, 2, None)
        assert False, "Should have raised HTTPException"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"PASS: Zero length rejected with detail: {e.detail}")

    # 7. Negative value -> HTTP 400
    try:
        validate_dimensions("LBH", -5, 5, 2, None)
        assert False, "Should have raised HTTPException"
    except HTTPException as e:
        assert e.status_code == 400
        print(f"PASS: Negative length rejected with detail: {e.detail}")

    # 8. Direct Quantity empty/non-numeric/zero/negative -> HTTP 400
    for invalid_dq in ["", "xyz", 0, -10]:
        try:
            validate_dimensions("DIRECT", None, None, None, invalid_dq)
            assert False, f"Should have raised HTTPException for dq={invalid_dq}"
        except HTTPException as e:
            assert e.status_code == 400
            print(f"PASS: DIRECT dq={invalid_dq} rejected with detail: {e.detail}")

    print("ALL TEST CASES PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_dimensions()
