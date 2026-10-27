import sys
import json
import urllib.request
import urllib.error
from datetime import datetime

BASE_URL = "http://127.0.0.1:8000"

# Import internal helpers to mint tokens for testing roles
from app.core.security import create_access_token
from app.database import SessionLocal
from app.models.user import User

db = SessionLocal()
mgr = db.query(User).filter(User.role == "manager").first()
tester = db.query(User).filter(User.role == "tester", User.is_active.is_(True)).first()
db.close()

if not mgr or not tester:
    print("Error: manager or tester user missing in DB.")
    sys.exit(1)

mgr_token = create_access_token({"sub": str(mgr.id), "role": "manager"})
tester_token = create_access_token({"sub": str(tester.id), "role": "tester"})

results = []

def call_api(name, method, path, data=None, token=None, expected_status=200):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode("utf-8") if data is not None else None

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    start = datetime.now()
    try:
        with urllib.request.urlopen(req) as resp:
            duration = (datetime.now() - start).total_seconds() * 1000
            resp_body = resp.read().decode("utf-8")
            parsed = json.loads(resp_body) if resp_body else {}
            passed = (resp.status == expected_status)
            results.append({
                "name": name,
                "method": method,
                "path": path,
                "status": resp.status,
                "expected": expected_status,
                "passed": passed,
                "duration_ms": round(duration, 1),
                "data": parsed
            })
            print(f"[{'PASS' if passed else 'FAIL'}] {method:<6} {path:<42} -> Status {resp.status} ({round(duration, 1)}ms)")
            return parsed
    except urllib.error.HTTPError as e:
        duration = (datetime.now() - start).total_seconds() * 1000
        resp_body = e.read().decode("utf-8")
        passed = (e.code == expected_status)
        results.append({
            "name": name,
            "method": method,
            "path": path,
            "status": e.code,
            "expected": expected_status,
            "passed": passed,
            "duration_ms": round(duration, 1),
            "error": resp_body
        })
        print(f"[{'PASS' if passed else 'FAIL'}] {method:<6} {path:<42} -> Status {e.code} ({e.reason}) ({round(duration, 1)}ms)")
        try:
            return json.loads(resp_body)
        except:
            return {"error": resp_body}
    except Exception as e:
        print(f"[FAIL] {method:<6} {path:<42} -> Exception: {e}")
        results.append({
            "name": name,
            "method": method,
            "path": path,
            "status": 0,
            "expected": expected_status,
            "passed": False,
            "error": str(e)
        })
        return None

print("=== STARTING FULL API VERIFICATION (GET, POST, PATCH, PUT, DELETE) ===\n")

# 1. Health & Root (GET)
call_api("Root endpoint", "GET", "/")
call_api("DB Health check", "GET", "/health/db")

# 2. Team Management (GET, POST, PATCH, PUT, DELETE)
call_api("Get Testers (Manager)", "GET", "/team/testers", token=mgr_token)
temp_email = f"auto_test_qa_{int(datetime.now().timestamp())}@example.com"
new_tester = call_api("Create Tester (Manager POST)", "POST", "/team/testers", {
    "name": "Automated Test QA",
    "email": temp_email,
    "password": "TempPassword@123"
}, token=mgr_token)
temp_tester_id = new_tester.get("id") if new_tester else None

# 3. Auth Login (POST using verified created credentials)
if temp_tester_id:
    call_api("Auth Login (Tester POST)", "POST", "/auth/login", {"email": temp_email, "password": "TempPassword@123"})
    call_api("Get Tester by ID (GET)", "GET", f"/team/testers/{temp_tester_id}", token=mgr_token)
    call_api("Toggle Tester Status (PATCH)", "PATCH", f"/team/testers/{temp_tester_id}/status", token=mgr_token)
    call_api("Toggle Tester Status (PUT)", "PUT", f"/team/testers/{temp_tester_id}/status", token=mgr_token)
    call_api("Delete Tester (DELETE)", "DELETE", f"/team/testers/{temp_tester_id}", token=mgr_token)

# 4. Projects (POST, GET, PATCH, PUT, DELETE)
temp_proj = call_api("Create Project (POST)", "POST", "/projects/", {
    "name": f"API Test Project {int(datetime.now().timestamp())}",
    "description": "Created for API automated verification",
    "excel_sheet_url": "https://docs.google.com/spreadsheets/d/test-sheet",
    "total_bugs": 10,
    "open_bugs": 4,
    "need_retest_bugs": 2,
    "retested_bugs": 2,
    "closed_bugs": 2,
    "critical_bugs": 1
}, token=mgr_token)
proj_id = temp_proj.get("id") if temp_proj else None

if proj_id:
    call_api("Get All Projects (GET)", "GET", "/projects/", token=mgr_token)
    call_api("Get Project by ID (GET)", "GET", f"/projects/{proj_id}", token=mgr_token)
    call_api("Get Project Progress (GET)", "GET", f"/projects/progress?project_id={proj_id}", token=mgr_token)

    # Assign tester (POST)
    call_api("Assign Tester (POST)", "POST", f"/projects/{proj_id}/assign", {"tester_id": tester.id}, token=mgr_token)
    call_api("Get Tester Projects (GET)", "GET", f"/projects/tester/{tester.id}", token=tester_token)

    # Update project status with PATCH and PUT
    call_api("Update Project Status (PATCH)", "PATCH", f"/projects/{proj_id}/status", {"status": "completed"}, token=mgr_token)
    call_api("Update Project Status (PUT)", "PUT", f"/projects/{proj_id}/status", {"status": "active"}, token=mgr_token)

    # Update project metrics with PATCH and PUT
    call_api("Update Sheet Metrics (PATCH)", "PATCH", f"/projects/{proj_id}/sheet-metrics", {
        "open_bugs": 6,
        "need_retest_bugs": 3,
        "retested_bugs": 1,
        "closed_bugs": 5,
        "critical_bugs": 2
    }, token=mgr_token)
    call_api("Update Sheet Metrics (PUT)", "PUT", f"/projects/{proj_id}/sheet-metrics", {
        "open_bugs": 5,
        "need_retest_bugs": 2,
        "retested_bugs": 2,
        "closed_bugs": 6,
        "critical_bugs": 1
    }, token=mgr_token)

    # Post project update (POST by tester)
    call_api("Post Project Update (POST)", "POST", f"/projects/{proj_id}/updates", {
        "tester_id": tester.id,
        "sprint_name": "Sprint Alpha",
        "progress": 70,
        "remarks": "API verification update",
        "excel_sheet_url": "https://docs.google.com/spreadsheets/d/test-sheet",
        "open_bugs": 5,
        "need_retest_bugs": 2,
        "retested_bugs": 2,
        "closed_bugs": 6,
        "critical_bugs": 1
    }, token=tester_token)

    # Get project updates (GET)
    call_api("Get Project Updates (GET)", "GET", f"/projects/{proj_id}/updates", token=tester_token)

    # 5. Bugs (POST, GET, PATCH, PUT, DELETE)
    temp_bug = call_api("Report Bug (POST by Tester)", "POST", "/bugs/", {
        "project_id": proj_id,
        "reported_by": tester.id,
        "title": "Automated verification defect",
        "description": "Regression test bug",
        "severity": "high"
    }, token=tester_token)
    bug_id = temp_bug.get("id") if temp_bug else None

    call_api("Get Bugs List (GET)", "GET", f"/bugs/?project_id={proj_id}", token=tester_token)
    call_api("Get Bug Summary (GET)", "GET", f"/bugs/summary?project_id={proj_id}", token=tester_token)

    if bug_id:
        call_api("Get Bug by ID (GET)", "GET", f"/bugs/{bug_id}", token=tester_token)
        call_api("Update Bug Status (PATCH)", "PATCH", f"/bugs/{bug_id}/status", {"status": "need_retest"}, token=tester_token)
        call_api("Update Bug Status (PUT)", "PUT", f"/bugs/{bug_id}/status", {"status": "retested"}, token=tester_token)
        call_api("Delete Bug (DELETE by Manager)", "DELETE", f"/bugs/{bug_id}", token=mgr_token)

    # 6. Notifications (GET, PATCH, PUT)
    notifs = call_api("Get Notifications (GET)", "GET", "/notifications/", token=tester_token)
    call_api("Get Unread Count (GET)", "GET", "/notifications/unread-count", token=tester_token)
    if notifs and len(notifs) > 0:
        notif_id = notifs[0].get("id")
        call_api("Mark Notification Read (PATCH)", "PATCH", f"/notifications/{notif_id}/read", token=tester_token)
        call_api("Mark Notification Read (PUT)", "PUT", f"/notifications/{notif_id}/read", token=tester_token)
    call_api("Mark All Notifications Read (PATCH)", "PATCH", "/notifications/mark-all-read", token=tester_token)
    call_api("Mark All Notifications Read (PUT)", "PUT", "/notifications/mark-all-read", token=tester_token)

    # 7. Unassign tester and cleanup project (DELETE)
    call_api("Unassign Tester (DELETE)", "DELETE", f"/projects/{proj_id}/assign/{tester.id}", token=mgr_token)
    call_api("Delete Project (DELETE)", "DELETE", f"/projects/{proj_id}", token=mgr_token)

# Summary
passed_count = sum(1 for r in results if r["passed"])
failed_count = sum(1 for r in results if not r["passed"])
print("\n=======================================================")
print(f"API Test Suite Summary: Total={len(results)}, Passed={passed_count}, Failed={failed_count}")
print("=======================================================")

method_counts = {}
for r in results:
    m = r["method"]
    if m not in method_counts:
        method_counts[m] = {"total": 0, "passed": 0, "failed": 0}
    method_counts[m]["total"] += 1
    if r["passed"]:
        method_counts[m]["passed"] += 1
    else:
        method_counts[m]["failed"] += 1

print("\nBreakdown by HTTP Method:")
for m, c in sorted(method_counts.items()):
    print(f"  {m:<7}: Total={c['total']}, Passed={c['passed']}, Failed={c['failed']}")
