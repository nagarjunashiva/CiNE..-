# CiNE Backend Server — MongoDB & Nodemailer Authentication

A production-ready Node.js & Express authentication and data synchronization service built for the CiNE web application.

---

## Features

- **Database:** MongoDB via Mongoose with User schema, password hashing (bcrypt), and cross-device Watchlist synchronization.
- **Email Delivery:** Nodemailer integration supporting Gmail SMTP, custom SMTP, or zero-config Ethereal test inbox.
- **Authentication Flows:**
  - **Registration with 6-Digit Email OTP:** Users receive an HTML verification email with an OTP code.
  - **OTP Verification:** Validates code, marks account verified, and issues secure JWT tokens.
  - **Sign In:** Verifies credentials against MongoDB with password hashing.
  - **Password Reset via Email OTP:** Forgot password flow with time-limited OTP codes.
  - **Watchlist Sync:** User collection stored directly in MongoDB.

---

## Quick Start

### 1. Start the Server
Double-click:
```
d:\CiNE\start-server.bat
```
Or run from terminal:
```bash
cd d:\CiNE\server
npm start
```
The server will start at `http://localhost:5000`.

### 2. Open CiNE
Open `file:///D:/CiNE/index.html#/` in Google Chrome and press `Ctrl + F5`.
The modal will show a green **"● MongoDB & Nodemailer Live"** indicator.

---

## Configuration (`.env`)

Edit `d:\CiNE\server\.env` to customize your credentials:

```ini
PORT=5000

# MongoDB URI: Leave blank to use auto-persisted embedded DB on D: drive,
# or paste your MongoDB Atlas connection string:
# MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/cine?retryWrites=true&w=majority

# JWT Secret
JWT_SECRET=cine_super_secret_jwt_key_2026_cinematic_auth

# Gmail SMTP (Optional)
# If using Gmail, generate an App Password at: https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM="CiNE Entertainment" <no-reply@cine.app>
```
*Note: If `SMTP_USER` is left as default, Nodemailer automatically creates an Ethereal test account and outputs direct browser preview links and OTP codes to your console log.*

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Health check & DB connection status |
| `POST` | `/api/auth/register` | Register user & dispatch 6-digit OTP email |
| `POST` | `/api/auth/verify-otp` | Verify 6-digit code & issue JWT token |
| `POST` | `/api/auth/resend-otp` | Request a new verification OTP |
| `POST` | `/api/auth/login` | Sign in with email & password |
| `POST` | `/api/auth/forgot-password` | Dispatch password reset OTP email |
| `POST` | `/api/auth/reset-password` | Update password using reset OTP |
| `GET` | `/api/auth/me` | Get logged-in user profile (`Bearer <token>`) |
| `GET` | `/api/auth/watchlist` | Get user's MongoDB watchlist |
| `POST` | `/api/auth/watchlist/toggle` | Add/remove movie in MongoDB watchlist |
