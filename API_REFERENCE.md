# Authentication API Reference

Base path: `/api/v1/auth`

Every response uses `{ "success": true, ... }` or `{ "success": false, "error": { "code", "message", "details?" } }`.

## Endpoint summary

| Method | Path | Authentication | Purpose |
| --- | --- | --- | --- |
| POST | `/work-email/request-otp` | Public | Start company-email verification |
| POST | `/work-email/resend-otp` | Public | Resend company-email OTP |
| POST | `/work-email/verify-otp` | Public | Verify OTP and receive registration token |
| POST | `/register` | Registration token in body | Create profile and sign in |
| POST | `/login` | Public | Sign in |
| POST | `/refresh` | Refresh token in body | Rotate refresh token and issue access token |
| POST | `/logout` | Bearer access token | Revoke one refresh token |
| POST | `/logout-all` | Bearer access token | Revoke every session |
| GET | `/me` | Bearer access token | Fetch signed-in user |
| POST | `/password/forgot` | Public | Request reset OTP |
| POST | `/password/resend-otp` | Public | Resend reset OTP |
| POST | `/password/reset` | Public | Verify OTP and replace password |

## Work-email verification

`POST /work-email/request-otp` and `POST /work-email/resend-otp`

```json
{
  "email": "ada.okafor@accessbankplc.com"
}
```

Successful `202` response data:

```json
{
  "challengeId": "665f1a2b3c4d5e6f708192a3",
  "email": "ada.okafor@accessbankplc.com",
  "expiresAt": "2026-07-06T12:10:00.000Z",
  "resendAvailableAt": "2026-07-06T12:01:00.000Z"
}
```

`POST /work-email/verify-otp`

```json
{
  "challengeId": "665f1a2b3c4d5e6f708192a3",
  "code": "123456"
}
```

The response data contains `registrationToken`, its lifetime, verified email, company name/domain, and `verifiedAt`. Send that token to registration; it is not an API access token.

## Registration

`POST /register`

```json
{
  "registrationToken": "<token returned by verify-otp>",
  "password": "a long unique password",
  "confirmPassword": "a long unique password",
  "fullName": "Ada Okafor",
  "personalEmail": "ada@example.net",
  "phone": "+2348000000000",
  "profilePhotoUrl": "https://cdn.example.com/profiles/ada.jpg",
  "jobTitle": "Product Manager",
  "department": "Digital Products",
  "industry": "Banking",
  "careerLevel": "Manager",
  "location": "Lagos, Nigeria",
  "shortBio": "I build useful financial products for people and businesses.",
  "linkedinUrl": "https://www.linkedin.com/in/ada-okafor",
  "professionalInterests": ["Product", "Finance"],
  "lookingFor": ["Networking", "Mentorship"]
}
```

`profilePhotoUrl` is optional. Every other field is required. A successful `201` response has the same `data` shape as login.

## Login and tokens

`POST /login`

```json
{
  "email": "ada.okafor@accessbankplc.com",
  "password": "a long unique password"
}
```

Successful response data:

```json
{
  "user": { "id": "...", "workEmail": "ada.okafor@accessbankplc.com" },
  "accessToken": "<short-lived JWT>",
  "accessTokenExpiresInSeconds": 900,
  "refreshToken": "<opaque rotating token>",
  "refreshTokenExpiresAt": "2026-08-05T12:00:00.000Z"
}
```

`POST /refresh`

```json
{ "refreshToken": "<current refresh token>" }
```

The response returns a new access token and a new refresh token. The submitted refresh token becomes invalid immediately. Reuse is treated as possible token theft and revokes the user's sessions.

`POST /logout` requires a valid Bearer access token and `{ "refreshToken": "..." }`. `POST /logout-all` requires only the Bearer access token.

## Password recovery

`POST /password/forgot` and `POST /password/resend-otp`

```json
{ "email": "ada.okafor@accessbankplc.com" }
```

These endpoints always return the same `202` message whether the account exists or not.

`POST /password/reset`

```json
{
  "email": "ada.okafor@accessbankplc.com",
  "code": "123456",
  "password": "a new long unique password",
  "confirmPassword": "a new long unique password"
}
```

A successful reset revokes every existing refresh session and invalidates issued access tokens.
