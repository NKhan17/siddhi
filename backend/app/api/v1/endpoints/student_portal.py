from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.permissions import AuthContext, require_roles
from app.models.entities import Student

router = APIRouter()

@router.get("/me")
def get_my_student_profile(ctx: AuthContext = Depends(require_roles("student")), db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.login_user_id == ctx.user.id, Student.school_id == ctx.active_school_id, Student.is_active.is_(True)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student profile not found")
    # Student-facing data only; no diagnosis, disability category, UDID, guardian contacts or case notes.
    return {
        "id": str(student.id), "full_name": student.full_name,
        "admission_number": student.admission_number, "grade_class": student.grade_class,
        "date_of_birth": student.date_of_birth.isoformat(), "strengths": student.strengths,
        "learning_style": student.learning_style, "languages_known": student.languages_known,
        "assistive_devices": student.assistive_devices,
    }
