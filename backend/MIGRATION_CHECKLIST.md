# MongoDB to Supabase Migration Checklist

This checklist reflects the current backend routes, Mongoose models/services, and frontend API calls. Keep MongoDB available until all active operations are migrated and verified.

## Runtime and Migration Safety

- [x] Keep `connectDB()` and schedule index setup in `src/server.js` while Mongoose-backed features remain.
- [x] Health endpoint reports MongoDB and Supabase availability; it probes `public.teachers` without reading rows.
- [ ] Add reviewed, resumable migration tooling with source/destination counts, relationship validation, and rollback documentation.
- [x] Add a unique sparse `User.supabaseUserId` crosswalk without replacing legacy Mongo ObjectIds; linking requires verified Supabase identity and the existing bcrypt password, not email alone.
- [ ] Validate production mappings and recovery/rollback procedures before treating the crosswalk as complete.
- [ ] Remove the test-suite `deleteMany` cleanup before running the legacy integration suite against any persistent data. Do not use destructive cleanup in migration verification.
- [ ] Audit archive/restore requirements and add reviewed schema/policy migrations before implementing archive behavior. No production archive/restore flow is currently present.

## Feature Migration

| Feature | Current implementation | Status |
| --- | --- | --- |
| Authentication and teacher profile | Supabase Auth handles active registration/login/session validation; `User.supabaseUserId` is a unique sparse crosswalk, while Mongo ObjectIds and Mongo role/status remain authoritative for business features. | Integrated with isolated tests. First-time legacy linking requires Supabase confirmation plus the legacy bcrypt password. No live-provider end-to-end test; `public.teachers` FK/RLS remains unverified and its profile helper is not used by active routes. |
| Teacher administration | `teacherController` and `User` model; create, list, edit, and status operations. | MongoDB; no Supabase replacement. |
| Departments | `Department` model and `academicService`; list/create/status operations. | MongoDB; no Supabase replacement. |
| Subjects and assignments | `Subject` model and `academicService`; references department and teacher ObjectIds. | MongoDB; requires validated ID crosswalk and relationship schema. |
| Schedules | `Schedule` model and `academicService`; teacher/subject ObjectId relationships and overlap/index rules. | MongoDB; no Supabase replacement. |
| Teacher attendance | `Attendance` model and `attendanceService`; check-in/out, history, daily absence generation, and dashboard statistics. | MongoDB; preserve unique teacher/date rule and history. |
| Leave requests | `LeaveRequest` model and `requestService`; teacher/reviewer ownership and notifications. | MongoDB. |
| Correction requests | `CorrectionRequest` model and `requestService`; references attendance, teacher, and reviewer. | MongoDB. |
| Notifications | `Notification` model and `requestService`; user ownership and read state. | MongoDB. |
| Reports and exports | `reportService` and `reportController`; joins/filtering depend on Mongo ObjectIds and related models. | MongoDB. |
| Audit logs | `AuditLog` model, `auditLogService`, and writes from controllers/services. | MongoDB; preserve actor and entity references. |
| Settings | `Settings` model and `settingsService`; audit writes included. | MongoDB. |
| Password recovery | `PasswordResetToken` model exists; current auth routes do not expose a recovery workflow. | No active route found; assess product requirement before migration. |
| Student attendance | No student model, route, controller, or frontend API call found in the current workspace surface. | Not an existing feature identified by this inventory. |

## Frontend and API

- [x] Frontend pages use the existing backend API client for authentication and business data; no direct Supabase data client is present in the inspected call paths.
- [ ] Preserve current routes, response shapes, loading/error states, and teacher/admin permissions while backend features move.
- [ ] Implement archived-item listing and restore actions only after additive schema and authorization policies are reviewed.

## Completion Gates

- [ ] Verify the `teachers.auth_user_id` foreign key and restrictive self-profile RLS policy from database metadata/policies.
- [ ] Validate each legacy-to-Supabase identity mapping without email-only matching.
- [ ] Migrate and test each feature before switching its production reads/writes.
- [ ] Verify archive/restore, ownership isolation, historical reporting, and migration rollback.
- [ ] Confirm no runtime imports, queries, startup hooks, or seed scripts require Mongoose before removing MongoDB dependencies or `connectDB()`.