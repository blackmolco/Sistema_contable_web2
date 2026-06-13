// Tests de integracion de la API con supertest (sin levantar el servidor)
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Env vars necesarias ANTES de cargar la app (app.js valida JWT_SECRET al inicio)
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-para-integracion-1234567890';
process.env.ADMIN_API_TOKEN = process.env.ADMIN_API_TOKEN || 'test-admin-token';

const request = require('supertest');
const jwt = require('jsonwebtoken');

let app;

beforeAll(() => {
  app = require('../app');
});

describe('Health check', () => {
  it('GET /api/health responde 200 o 503 con estructura esperada', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('db');
    expect(res.body.checks).toHaveProperty('uploads');
  });
});

describe('Autenticacion en endpoints protegidos', () => {
  it('GET /api/cuentas sin token responde 401', async () => {
    const res = await request(app).get('/api/cuentas');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/cuentas con token invalido responde 403', async () => {
    const res = await request(app)
      .get('/api/cuentas')
      .set('Authorization', 'Bearer token-invalido-xyz');
    expect(res.status).toBe(403);
    expect(res.body).toHaveProperty('error');
  });
});

describe('Login', () => {
  it('login con credenciales invalidas (formato valido) responde 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'noexiste@test.cl', password: 'password-incorrecto-123' });
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('login con body malformado responde 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'no-es-email', password: 'corta' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

describe('Aislamiento de tenant', () => {
  const EMPRESA_A = '11111111-1111-4111-8111-111111111111';
  const EMPRESA_B = '22222222-2222-4222-8222-222222222222';

  function tokenEmpresa(empresaId) {
    return jwt.sign(
      { id: 'user-test', email: 'tenant@test.cl', rol: 'contador', empresaId },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
  }

  it('GET /api/cuentas ignora empresaId de otro tenant via query', async () => {
    const token = tokenEmpresa(EMPRESA_A);
    const res = await request(app)
      .get(`/api/cuentas?empresaId=${EMPRESA_B}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const cuentas = res.body.data ?? res.body;
    expect(Array.isArray(cuentas)).toBe(true);
    // Solo cuentas de la empresa A (del token) o vacio — nunca de la empresa B
    for (const c of cuentas) {
      expect(c.empresaId).toBe(EMPRESA_A);
    }
  });
});
