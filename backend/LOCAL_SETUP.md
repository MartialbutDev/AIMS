# Local AIMS setup and review

Use Python and Node versions compatible with requirements.txt and mobile/package.json (Node 22 is supported by the mobile project). Never copy the deployed database onto the local database or the local database onto EC2.

## Existing local installation

1. Keep the backend .env connected to localhost/aims_db. Set an independently generated local SECRET_KEY; do not reuse EC2 secrets. Check CURRENT_ACADEMIC_YEAR/CURRENT_SEMESTER before testing documents.
2. Back up the local database, then run `python -m alembic upgrade head` from backend. The new assessment migration preserves NULL-term legacy grades without guessing their term. New assessments always include the year and semester. The integrity-guard migration refuses conflicting records instead of deleting any.
3. Start `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
4. Start web/aims with `npm run dev`. Its proxy now defaults to localhost:8000. VITE_API_BASE_URL should be blank for the local proxy; an explicit environment override still takes priority.
5. For mobile, copy mobile/.env.example to mobile/.env.local and replace the example IP with this PC's LAN IPv4. Set both EXPO_PUBLIC_BASE_URL and EXPO_PUBLIC_API_URL. Restart Expo with `npx expo start --go --clear`. Use a compatible SDK 54 Expo Go for supported screens. The installed preview APK continues to use EC2; local source changes do not update that APK. Push needs an AIMS native development/release build.

## A genuinely new database

Create a dedicated empty PostgreSQL database owned by the application role and configure backend/.env. Install requirements, then run:

```
python bootstrap_database.py
python create_admin_user.py
```

The bootstrap registers all current models, creates current tables, and stamps the current Alembic head in one PostgreSQL transaction. It refuses an existing application schema. Existing databases must use migrations instead. Do not run the historical empty-baseline migration chain as the only fresh-installation step and do not stamp a pre-existing schema blindly.

## Review cases

- Administrator Student Assignments shows the current academic term and which coordinators have an active designation for that term.
- Assign an unassigned student. Confirm the new assignment includes year/semester and a second identical assignment returns an accurate conflict.
- A past-term assignment must not block a new-term assignment; removing the current one must retain history. A stale browser tab cannot change another term.
- Coordinator internal assessments are separate from official completion-grade release. Save in two terms and confirm neither overwrites the other or a legacy NULL-term grade.
- Current-term DTR/journal reviews work even when the student has history. Historical/unclassified records remain locked in the current-term review endpoint.
- Check the normal endorsement, company acceptance, deployment, monitoring and completion flow. Confirm returned/pending documents still block the relevant action.
- Applications, forwarding (including school-arranged placements), company interview/acceptance and deployment confirmation require approved orientation and COR onboarding records. Missing, pending or rejected current submissions block advancement with HTTP 409. The development onboarding UI bypass does not authorize these writes; rejection and withdrawal remain available.

## Deployment boundary

Only EC2 security, OCR configuration and the EmailJS OTP transport fix were activated now. Assignment/assessment changes, the new setup command, migrations, upload-ignore rule, local connection defaults and mobile text fixes remain local for review. Do not run the new migrations or deploy the web build to EC2 before that review.

Onboarding uploads are now ignored. Previously tracked upload deletions are preserved in the working tree; ignoring a folder alone does not remove Git history. Review removal/history treatment before publishing sensitive repositories.

## Scheduled backups

The standalone operator and daily EC2 service/timer are documented in [ops/README.md](ops/README.md). They are not part of API startup. Installation does not enable the timer; configure an offline recovery key and run a manual backup/recovery check first. Local rehearsals must use disposable targets, never a copy-over of the deployed database or local database.
