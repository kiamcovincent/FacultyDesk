# FacultyDesk Testing

## Automated Checks

Run commands separately from PowerShell. You can run them from any directory by using the absolute project paths:

```powershell
npm.cmd --prefix C:\Users\lazar\Documents\FacultyDesk\backend test
npm.cmd --prefix C:\Users\lazar\Documents\FacultyDesk\frontend run build
npm.cmd --prefix C:\Users\lazar\Documents\FacultyDesk\frontend run lint
```

The backend tests use `TEST_MONGO_URI` when configured, otherwise they use the local `teacher_attendance_test` database. The suite clears its test collections before and after execution. Never point `TEST_MONGO_URI` at the school’s real database.

## Manual MVP Checklist

### Authentication and roles

- [ ] Register a teacher with a valid name, email, and password.
- [ ] Try an invalid email, short password, and duplicate email; verify each is rejected.
- [ ] Sign in with an incorrect password; verify the UI shows an error and no session is created.
- [ ] Sign in, refresh the page, and verify the httpOnly-cookie session is restored.
- [ ] Sign out and verify protected pages return to sign-in.
- [ ] Sign in as a teacher and try `/admin/dashboard`, `/admin/teachers`, `/admin/attendance`, `/admin/reports`, `/admin/settings`, and `/admin/audit-logs`; verify access is denied server-side.

### Attendance

- [ ] Check in before work start plus grace; verify `present`.
- [ ] Submit a second check-in for that day; verify it is rejected.
- [ ] Check out without a check-in; verify it is rejected.
- [ ] Check out after a valid check-in, then submit another check-out; verify the duplicate is rejected.
- [ ] Review personal history and filter by date; verify only the signed-in teacher’s records appear.
- [ ] As an admin, filter school attendance by date and status.

### Requests and reports

- [ ] Submit a leave request as a teacher; approve or reject it as an admin.
- [ ] Submit an attendance correction for the teacher’s own record; review it as an admin and verify the audit entry.
- [ ] As a teacher, attempt to request a correction for another teacher’s record; verify it is rejected.
- [ ] Mark a notification read and verify the unread count updates.
- [ ] Filter an admin attendance report by date, teacher, department, subject assignment, and status; export the results as CSV.

### Settings, database, and accessibility

- [ ] Update work start/end, grace period, and time zone as an admin; verify invalid end-before-start times and invalid time zones are rejected.
- [ ] Stop the local MongoDB service, restart the API, and verify `/api/health` reports `503` and `DATABASE_UNAVAILABLE`; restart MongoDB and verify health recovers.
- [ ] At a 390px-wide viewport, visit login, dashboard, requests, settings, and reports; verify no horizontal page overflow and controls remain usable.
- [ ] Use Tab/Shift+Tab to reach navigation, form fields, and buttons; verify visible focus, Enter/Space activation, and no keyboard trap.
- [ ] Enable the operating system’s reduced-motion preference and verify magnetic movement and transitions are reduced.
