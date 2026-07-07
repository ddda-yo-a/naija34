# Naija34 Backend

Production-oriented Node.js, Express, and MongoDB authentication API for the 34th Street Naija mobile app.

## What is implemented

- Approved-company work-email OTP request, resend, and verification
- Profile completion and account registration
- Argon2id password hashing
- Short-lived JWT access tokens
- Opaque, hashed, rotating refresh tokens with reuse detection
- Login, current-user, single-device logout, and all-device logout
- Forgot-password, reset OTP, password reset, and session revocation
- Request validation, CORS allow-listing, security headers, rate limits, structured logs, and safe error responses
- TTL indexes for automatic OTP and expired-session cleanup
- End-to-end authentication tests using an isolated in-memory MongoDB

## Project structure

```text
src/
  config/       Environment, MongoDB, and logger setup
  controllers/  HTTP request/response handling
  data/         Server-side approved company domains
  middleware/   Authentication, validation, limits, and errors
  models/       Mongoose persistence models
  routes/       Versioned Express routes
  services/     Authentication, OTP, email, password, and token logic
  utils/        Cryptography and shared errors
  validators/   Zod API contracts
tests/          Full authentication lifecycle tests
```

## Local setup

1. Use Node.js 22 or later.
2. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

3. Replace `MONGODB_URI`, `JWT_ACCESS_SECRET`, and `OTP_PEPPER`. Generate the two secrets independently:

   ```bash
   openssl rand -base64 64
   ```

4. Keep `EMAIL_DELIVERY_MODE=log` during local development. OTP codes will appear in the API terminal. Configure the SMTP placeholders and switch to `smtp` before production.
5. Start the API:

   ```bash
   npm install
   npm run dev
   ```

The default API root is `http://localhost:4000/api/v1`, and health is available at `GET /health`.

## Authentication flow used by the mobile screens

1. `AuthScreen` calls `POST /auth/work-email/request-otp`.
2. `VerificationScreen` calls `POST /auth/work-email/verify-otp` and keeps the returned short-lived `registrationToken`.
3. `RegistrationScreen` collects the remaining profile and password, then calls `POST /auth/register`. Registration returns the signed-in user and both tokens.
4. `LoginScreen` calls `POST /auth/login`.
5. `ForgotPasswordScreen` calls `POST /auth/password/forgot`.
6. `ResetPasswordScreen` calls `POST /auth/password/reset` with its email, six-digit code, and new password.

Important frontend integration note: the present `RegistrationScreen.js` has no password fields, although `LoginScreen.js` expects password authentication. Add password and confirmation fields during API integration. The backend deliberately enforces a minimum of 10 characters. The current photo control is also a UI placeholder; `profilePhotoUrl` is optional until file/media upload is built.

See [API_REFERENCE.md](./API_REFERENCE.md) for exact payloads and responses.

## Token handling in the Expo app

- Keep the access token in application memory and send it as `Authorization: Bearer <accessToken>`.
- Store the refresh token in Expo SecureStore, never AsyncStorage.
- When `/auth/refresh` succeeds, immediately replace the stored refresh token with the new one.
- If refresh returns `401`, clear local authentication state and return to login.
- Never log either token or an OTP in the mobile app.

## Production checklist

- Use MongoDB Atlas credentials with the least database privileges required.
- Use distinct, randomly generated production secrets; never commit `.env`.
- Configure a verified SMTP sender and leave `EMAIL_DELIVERY_MODE=smtp`.
- Set only real browser origins in `CORS_ORIGINS` and the correct reverse-proxy hop count in `TRUST_PROXY`.
- Terminate HTTPS at the load balancer or hosting platform.
- Use a shared rate-limit store such as Redis when running more than one API instance.
- Keep the server-side domain list synchronized with `naija34/data/companyDomains.js`.
- Run `npm audit --omit=dev` and `npm test` in CI before deployment.

