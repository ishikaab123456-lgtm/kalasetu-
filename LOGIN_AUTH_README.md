# KalaSetu Role + OTP Login — Ready Version

This project now starts with an interactive authentication gate.

## What was added

- Artisan / Consumer role toggle
- Mobile Number / Email verification toggle
- 6-digit OTP screen
- OTP expiry (5 minutes)
- Wrong OTP handling + attempt limit
- Session token after verification
- Session restore on refresh
- Logout button
- Secure role switching: changing Artisan ↔ Consumer asks for verification again
- First-login optional name
- Dynamic Artisan greeting
- `data/users.json` for prototype user records

## SIH demo behaviour

By default `AUTH_DEMO_OTP=true`.

This means the website generates a real random 6-digit OTP on the server, validates it, and also shows that OTP on the login screen so the prototype can be demonstrated without buying an SMS/email service.

For a production version, set:

```env
AUTH_DEMO_OTP=false
```

and replace the delivery step in `routes/auth.js` with your chosen SMS/email provider (for example Supabase Auth, Twilio, MSG91, Firebase Phone Auth, or an email OTP provider).

## Fastest way to run on Windows

1. Install Node.js LTS if not already installed.
2. Extract the project ZIP.
3. Double-click `START_KALASETU.bat`.
4. Browser opens `http://localhost:4000`.
5. Choose Artisan or Consumer.
6. Choose Mobile Number or Email.
7. Enter the contact detail → Send OTP.
8. Demo OTP appears → type it → Verify & Continue.

## Manual run

```powershell
npm install
copy .env.example .env
npm start
```

Open:

`http://localhost:4000`

## Files changed for authentication

### Backend
- `routes/auth.js` — OTP generation, verification, session and logout
- `index.js` — mounts `/api/auth`
- `data/users.json` — prototype users

### Frontend
- `public/index.html` — role/method/OTP login UI
- `public/styles.css` — responsive login design
- `public/app.js` — login flow, session restore, logout, role switching

## Authentication API

### Send OTP
`POST /api/auth/send-otp`

```json
{
  "role": "artisan",
  "method": "phone",
  "identifier": "9876543210"
}
```

### Verify OTP
`POST /api/auth/verify-otp`

```json
{
  "role": "artisan",
  "method": "phone",
  "identifier": "9876543210",
  "otp": "123456",
  "name": "Sunita Devi"
}
```

### Current user
`GET /api/auth/me`
Header: `Authorization: Bearer <token>`

### Logout
`POST /api/auth/logout`
Header: `Authorization: Bearer <token>`

## GitHub upload

Do not upload your real `.env` file or API keys.

Recommended commands:

```powershell
git checkout -b artisan-login-auth
git add routes/auth.js index.js public/index.html public/styles.css public/app.js data/users.json .env.example START_KALASETU.bat LOGIN_AUTH_README.md
git commit -m "Add role based OTP login authentication"
git push -u origin artisan-login-auth
```

Then create a Pull Request on GitHub.
