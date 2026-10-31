# KalaSetu Password Login — SIH Ready

OTP has been completely removed from this version.

## Login flow

Choose role:
- Artisan
- Consumer

Choose login ID:
- Mobile Number
- Email

Then:
Login ID + Password → Secure backend verification → Role dashboard

## Included

- Artisan / Consumer toggle
- Phone / Email toggle
- Password login
- Show / hide password
- Remember me
- Create account
- Password strength validation
- Forgot Password
- New Password reset screen
- Salted password hashing using Node.js `crypto.scrypt`
- Session token
- Logout
- Role-based access

## Demo accounts

### Artisan
Email:
`artisan@kalasetu.demo`

Password:
`KalaSetu@123`

Phone:
`9876543210`

Password:
`KalaSetu@123`

### Consumer
Email:
`consumer@kalasetu.demo`

Password:
`KalaSetu@123`

Phone:
`9876543211`

Password:
`KalaSetu@123`

## Forgot Password

There is NO OTP.

For the local SIH prototype:
1. Select the correct role.
2. Select Phone or Email.
3. Press `Forgot password?`
4. Enter the registered login ID.
5. KalaSetu creates a short-lived reset session.
6. Enter the new password.
7. Login again.

For a production deployment, the same reset token should be sent as a secure email/SMS reset link instead of opening directly in the browser.

## Run on Windows

Extract the ZIP and double-click:

`START_KALASETU.bat`

Or run:

```powershell
npm install
npm start
```

Open:

`http://localhost:4000`
