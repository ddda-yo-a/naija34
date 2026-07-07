import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { deliveredEmails } = vi.hoisted(() => ({ deliveredEmails: [] }));

// Capturing outgoing messages makes the test behave like a mailbox without using real SMTP.
vi.mock('../src/services/email.service.js', () => ({
  sendOtpEmail: vi.fn(async (message) => deliveredEmails.push(message)),
}));

const { app } = await import('../src/app.js');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

beforeEach(async () => {
  deliveredEmails.length = 0;
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('authentication lifecycle', () => {
  it('verifies workmail, registers, refreshes, recovers the password, and detects token reuse', async () => {
    const workEmail = 'ada.okafor@accessbankplc.com';

    const requested = await request(app)
      .post('/api/v1/auth/work-email/request-otp')
      // A spoofed display name is ignored; the API resolves the canonical company by domain.
      .send({ email: workEmail, companyName: 'Spoofed Company Name' })
      .expect(202);

    expect(requested.body.data.challengeId).toMatch(/^[a-f\d]{24}$/);
    expect(deliveredEmails).toHaveLength(1);

    const verified = await request(app)
      .post('/api/v1/auth/work-email/verify-otp')
      .send({
        challengeId: requested.body.data.challengeId,
        code: deliveredEmails.at(-1).code,
      })
      .expect(200);

    const registered = await request(app)
      .post('/api/v1/auth/register')
      .send({
        registrationToken: verified.body.data.registrationToken,
        password: 'Rainy-Eko-Nights-2040',
        confirmPassword: 'Rainy-Eko-Nights-2040',
        fullName: 'Ada Okafor',
        personalEmail: 'ada.okafor@example.net',
        phone: '+2348000000000',
        jobTitle: 'Product Manager',
        department: 'Digital Products',
        industry: 'Banking',
        careerLevel: 'Manager',
        location: 'Lagos, Nigeria',
        shortBio: 'I build useful financial products for people and businesses.',
        linkedinUrl: 'https://www.linkedin.com/in/ada-okafor',
        professionalInterests: ['Product', 'Finance'],
        lookingFor: ['Networking', 'Mentorship'],
      })
      .expect(201);

    const originalAccessToken = registered.body.data.accessToken;
    const originalRefreshToken = registered.body.data.refreshToken;
    expect(registered.body.data.user.company.name).toBe('Access Bank');
    expect(registered.body.data.user).not.toHaveProperty('passwordHash');

    await request(app)
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${originalAccessToken}`)
      .expect(200);

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken })
      .expect(200);
    expect(rotated.body.data.refreshToken).not.toBe(originalRefreshToken);

    await request(app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: workEmail })
      .expect(202);
    const resetCode = deliveredEmails.at(-1).code;

    await request(app)
      .post('/api/v1/auth/password/reset')
      .send({
        email: workEmail,
        code: resetCode,
        password: 'Harmattan-Morning-2050',
        confirmPassword: 'Harmattan-Morning-2050',
      })
      .expect(200);

    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: workEmail, password: 'Rainy-Eko-Nights-2040' })
      .expect(401);

    const loggedIn = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: workEmail, password: 'Harmattan-Morning-2050' })
      .expect(200);

    // Reusing a rotated token is treated as theft and revokes the user's other sessions.
    await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: originalRefreshToken })
      .expect(401);

    await request(app)
      .get('/api/v1/auth/me')
      .set('authorization', `Bearer ${loggedIn.body.data.accessToken}`)
      .expect(401);
  });

  it('does not reveal whether a password-recovery account exists', async () => {
    const response = await request(app)
      .post('/api/v1/auth/password/forgot')
      .send({ email: 'nobody@accessbankplc.com' })
      .expect(202);

    expect(response.body.message).toContain('If an active account matches');
    expect(deliveredEmails).toHaveLength(0);
  });

  it('rejects company emails outside the approved directory', async () => {
    const response = await request(app)
      .post('/api/v1/auth/work-email/request-otp')
      .send({ email: 'person@unlisted-company.example', companyName: 'Unlisted' })
      .expect(400);

    expect(response.body.error.code).toBe('COMPANY_EMAIL_REQUIRED');
  });
});
