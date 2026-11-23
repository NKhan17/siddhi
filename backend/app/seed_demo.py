import uuid
import argparse
import json
from datetime import date, datetime, timezone
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.entities import (
    School, User, SchoolMembership, Student, GuardianStudentLink,
    StaffStudentAssignment, PresentLevelRecord, IEPPlan, IEPGoal,
    GoalObjective, ProgressEntry, TherapySession, Accommodation,
    ParentInteraction, AssessmentRecord, AttendanceRecord,
    IEPReview, IEPApproval,
)
# Great generator library for synthetic data
try:
    from great_generator import generate_students, generate_staff, generate_guardians
except ImportError:
    # Fallback simple generator using Faker for students
    from faker import Faker
    import random
    fake = Faker()
    def generate_students(n):
        students = []
        for i in range(n):
            admission = f"ADM-{2026+i:04d}"
            name = fake.name()
            dob = fake.date_of_birth(minimum_age=5, maximum_age=18)
            gender = random.choice(['Male', 'Female'])
            category = random.choice(['Autism Spectrum Disorder', 'Specific Learning Disability', 'ADHD', 'Locomotor Disability', 'Intellectual Disability'])
            enrollment_date = fake.date_between(start_date='-5y', end_date='today')
            grade = f"Grade {random.randint(1,12)}-{random.choice(['A','B','C'])}"
            students.append({
                "admission_number": admission,
                "full_name": name,
                "date_of_birth": dob,
                "gender": gender,
                "disability_category": category,
                "enrollment_date": enrollment_date,
                "grade_class": grade,
                "diagnosis": "",
                "strengths": "",
                "areas_of_need": "",
                "learning_style": "",
                "languages_known": "English",
                "assistive_devices": "",
            })
        return students
    def generate_staff(n):
        return []
    def generate_guardians(n):
        return []

def truncate_tables(db: Session):
    """Truncate all tables in proper order for SQLite.
    Uses DELETE FROM for each table and resets AUTOINCREMENT.
    Ignores missing tables (e.g., during early runs).
    """
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError
    tables = [
        "guardian_student_links",
        "staff_student_assignments",
        "attendance_records",
        "assessment_records",
        "parent_interactions",
        "accommodations",
        "therapy_sessions",
        "progress_entries",
        "goal_objectives",
        "iep_goals",
        "iep_plans",
        "present_level_records",
        "students",
        "users",
        "school_memberships",
        "schools",
    ]
    for tbl in tables:
        try:
            db.execute(text(f"DELETE FROM {tbl};"))
            if db.bind.dialect.name == "sqlite": db.execute(text(f"DELETE FROM sqlite_sequence WHERE name='{tbl}';"))
        except OperationalError:
            # Table may not exist yet; ignore
            continue
    db.commit()

def seed_database():
    parser = argparse.ArgumentParser(description="Seed the Siddhi database.")
    parser.add_argument("--reset", action="store_true", help="Truncate tables before seeding.")
    args, _ = parser.parse_known_args()

    db: Session = SessionLocal()
    try:
        if args.reset:
            truncate_tables(db)

        # 1. School
        school = School(
            id=uuid.uuid4(),
            name="St. Jude Inclusive Academy",
            code="SJA-001",
            address="12 Garden Valley Road, Knowledge Hub",
            is_active=True,
        )
        db.add(school)
        db.commit()

        # Helper functions
        def make_user(email: str, name: str, password: str, phone: str = "555-0100", faculty_id: str | None = None):
            u = User(
                id=uuid.uuid4(),
                faculty_id=faculty_id,
                email=email.lower().strip(),
                password_hash=get_password_hash(password),
                full_name=name,
                phone=phone,
                is_active=True,
            )
            db.add(u)
            db.commit()
            return u

        def add_membership(user_id: uuid.UUID, role: str):
            mem = SchoolMembership(
                id=uuid.uuid4(),
                school_id=school.id,
                user_id=user_id,
                role=role,
                is_active=True,
            )
            db.add(mem)
            db.commit()
            return mem

        # 2. Staff & Guardian accounts (including a demo student for quick test)
        accounts = [
            ("admin@siddhi.test", "Sanjay Deshmukh (Admin)", "SiddhiAdmin2026!", "555-0101", "FAC-ADMIN-001", "school_admin"),
            ("principal@siddhi.test", "Dr. Shalini Menon (School Head)", "SiddhiHead2026!", "555-0102", "FAC-HEAD-001", "school_head"),
            ("educator1@siddhi.test", "Ananya Sharma (Special Educator)", "SiddhiEducator2026!", "555-0103", "FAC-EDU-001", "special_educator"),
            ("educator2@siddhi.test", "Rajesh Kumar (Special Educator)", "SiddhiEducator2026!", "555-0104", "FAC-EDU-002", "special_educator"),
            ("therapist@siddhi.test", "Priya Nair (Lead Therapist)", "SiddhiTherapy2026!", "555-0105", "FAC-THER-001", "therapist"),
            ("psychologist@siddhi.test", "Dr. Arjun Verma (Psychologist)", "SiddhiPsych2026!", "555-0106", "FAC-PSY-001", "psychologist"),
            ("psychiatrist@siddhi.test", "Dr. Kavita Rao (Psychiatrist)", "SiddhiPsychiatrist2026!", "555-0109", "FAC-PSYCH-001", "psychiatrist"),
            ("guardian.single@siddhi.test", "Sunita Patel", "SiddhiGuardian2026!", "555-0107", None, "guardian"),
            ("guardian.multi@siddhi.test", "Meera Iyer", "SiddhiGuardian2026!", "555-0108", None, "guardian"),
            ("aarav.student@siddhi.test", "Aarav Patel", "SiddhiStudent2026!", "555-0111", None, "student"),
        ]
        users = {}
        for email, name, pwd, phone, fac_id, role in accounts:
            user = make_user(email, name, pwd, phone, fac_id)
            add_membership(user.id, role)
            users[email] = user

        # 3. Generate 500 synthetic students using great-generator
        synthetic_students = generate_students(500)
        # Expect each dict to contain keys matching our Student model fields; adjust if needed.
        student_password = "StudentPass2026!"
        all_credentials = []
        for spec in synthetic_students:
            # Mapping – assume spec provides: admission_number, full_name, date_of_birth (date), gender,
            # disability_category, enrollment_date, grade_class, diagnosis, strengths, areas_of_need,
            # learning_style, languages_known, assistive_devices
            admission = spec.get("admission_number") or f"ADM-{uuid.uuid4().hex[:8].upper()}"
            name = spec.get("full_name", "Student")
            dob = spec.get("date_of_birth", date(2015, 1, 1))
            gender = spec.get("gender", "Other")
            category = spec.get("disability_category", "Other")
            enrolled = spec.get("enrollment_date", date.today())
            grade = spec.get("grade_class", "Grade 1-A")
            diagnosis = spec.get("diagnosis", "")
            strengths = spec.get("strengths", "")
            needs = spec.get("areas_of_need", "")
            learning_style = spec.get("learning_style", "")
            languages = spec.get("languages_known", "English")
            devices = spec.get("assistive_devices", "")

            # Create Student record
            student = Student(
                id=uuid.uuid4(),
                school_id=school.id,
                admission_number=admission,
                full_name=name,
                date_of_birth=dob,
                gender=gender,
                disability_category=category,
                enrollment_date=enrolled,
                grade_class=grade,
                diagnosis=diagnosis,
                strengths=strengths,
                areas_of_need=needs,
                learning_style=learning_style,
                languages_known=languages,
                assistive_devices=devices,
                is_active=True,
            )
            db.add(student)
            db.flush()
            # Create linked User for login
            email = f"{admission.lower()}@student.siddhi.test"
            user = make_user(email, name, student_password, phone="555-0123")
            # Bind login
            student.login_user_id = user.id
            db.add(student)  # update with login_user_id
            db.flush()
            # Add school membership for the student user
            add_membership(user.id, "student")
            # Record credential
            all_credentials.append({
                "role": "student",
                "admission_number": admission,
                "email": email,
                "password": student_password,
                "grade_class": grade,
            })

        # 4. Guardian links (simple 1‑to‑many mapping for demo purposes)
        guardian_users = [users["guardian.single@siddhi.test"], users["guardian.multi@siddhi.test"]]
        for i, (admission, student) in enumerate(db.query(Student.admission_number, Student.id).filter(Student.school_id == school.id).all()):
            guardian = guardian_users[i % len(guardian_users)]
            link = GuardianStudentLink(
                school_id=school.id,
                guardian_user_id=guardian.id,
                student_id=student,
                relationship_label="Parent",
                is_primary=True,
                is_active=True,
            )
            db.add(link)

        db.commit()
        # Write credentials to JSON file (added to .gitignore)
        cred_path = "seed_credentials.json"
        with open(cred_path, "w", encoding="utf-8") as f:
            json.dump(all_credentials, f, indent=2, default=str)
        # Print concise table to console
        print("=== Seeded Student Credentials ===")
        for cred in all_credentials[:10]:  # show first 10 for brevity
            print(f"{cred['admission_number']}: {cred['email']} / {cred['password']} (Grade: {cred['grade_class']})")
        print(f"... {len(all_credentials)-10} more students seeded ...")
        print(f"Full list written to {cred_path}")
        print("Seeding complete: 500 synthetic students, staff, guardians, and school.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
