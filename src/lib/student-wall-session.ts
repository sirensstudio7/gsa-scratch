/** Set when welcome sends a student to /wall for the 100% celebration. */
export const GSA_STUDENT_WALL_SESSION = "gsa_student_wall_session";

export function markStudentWallSession() {
  try {
    sessionStorage.setItem(GSA_STUDENT_WALL_SESSION, "1");
  } catch {
    /* ignore */
  }
}

export function isStudentWallSession(): boolean {
  try {
    return sessionStorage.getItem(GSA_STUDENT_WALL_SESSION) === "1";
  } catch {
    return false;
  }
}

export function clearStudentWallSession() {
  try {
    sessionStorage.removeItem(GSA_STUDENT_WALL_SESSION);
  } catch {
    /* ignore */
  }
}
