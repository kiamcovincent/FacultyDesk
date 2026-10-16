# FacultyDesk Android App

FacultyDesk uses Capacitor to package the existing React/Vite interface as an Android app. Express and MongoDB remain the single backend; the app calls the same REST API over HTTPS.

## Requirements

- Node.js and npm
- Android Studio with an Android SDK installed
- A configured Android emulator or USB-debugging-enabled Android device
- A deployed HTTPS FacultyDesk API for reliable sign-in and cookie sessions

This project uses httpOnly JWT cookies. Android production deployments must use HTTPS, set `NODE_ENV=production`, and set `AUTH_COOKIE_SAME_SITE=none`. The backend then marks the cookie Secure. Do not move the JWT to localStorage.

## Install and Generate the Android Project

From the workspace root in PowerShell:

```powershell
npm.cmd --prefix C:\Users\lazar\Documents\FacultyDesk\frontend install
npm.cmd --prefix C:\Users\lazar\Documents\FacultyDesk\frontend install @capacitor/core @capacitor/android
npm.cmd --prefix C:\Users\lazar\Documents\FacultyDesk\frontend install --save-dev @capacitor/cli
Copy-Item C:\Users\lazar\Documents\FacultyDesk\frontend\.env.android.example C:\Users\lazar\Documents\FacultyDesk\frontend\.env.android
```

Edit `frontend/.env.android` and replace the example URL with your deployed API URL. Keep the API URL ending in `/api`. This local file is ignored by Git.

Generate the Android platform project and sync the bundled frontend:

```powershell
npm.cmd --prefix C:\Users\lazar\Documents\FacultyDesk\frontend exec cap add android
npm.cmd --prefix C:\Users\lazar\Documents\FacultyDesk\frontend run android:sync
npm.cmd --prefix C:\Users\lazar\Documents\FacultyDesk\frontend run android:open
```

In Android Studio, wait for Gradle sync, select an emulator or connected phone, then use **Run**. The generated `frontend/android` project should be committed so the native project configuration is versioned; do not commit local signing keys or machine-specific secrets.

## Local API Testing

A phone cannot use `localhost` to reach the development computer. For a physical device, the API must be reachable at the computer’s LAN address and allowed through Windows Firewall. Android may block plain HTTP; prefer a temporary HTTPS development tunnel or an HTTPS staging API.

Add the exact Capacitor origin and any web development origin to the comma-separated `FRONTEND_URL` in `backend/.env`, for example:

```text
FRONTEND_URL=http://localhost:5173,https://localhost
```

Never use `*` for credentialed CORS. For Android production, configure the backend cookie with `AUTH_COOKIE_SAME_SITE=none`, `NODE_ENV=production`, and HTTPS on both the app/API paths. Verify registration, login persistence, logout, check-in, and reports on a real device before release.
