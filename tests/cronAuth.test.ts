import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorizedCron } from '../lib/cronAuth';

function reqWithAuth(value?: string): Request {
  const headers = new Headers();
  if (value !== undefined) headers.set('authorization', value);
  return new Request('http://localhost/api/cron/test', { headers });
}

test('isAuthorizedCron fails closed when CRON_SECRET is unset', () => {
  const prev = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  try {
    assert.equal(isAuthorizedCron(reqWithAuth('Bearer undefined')), false);
    assert.equal(isAuthorizedCron(reqWithAuth('Bearer ')), false);
    assert.equal(isAuthorizedCron(reqWithAuth()), false);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});

test('isAuthorizedCron accepts the exact bearer token', () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 's3cr3t-value';
  try {
    assert.equal(isAuthorizedCron(reqWithAuth('Bearer s3cr3t-value')), true);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});

test('isAuthorizedCron rejects wrong or malformed tokens', () => {
  const prev = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 's3cr3t-value';
  try {
    assert.equal(isAuthorizedCron(reqWithAuth('Bearer wrong')), false);
    assert.equal(isAuthorizedCron(reqWithAuth('s3cr3t-value')), false);
    assert.equal(isAuthorizedCron(reqWithAuth('Bearer s3cr3t-value-extra')), false);
    assert.equal(isAuthorizedCron(reqWithAuth()), false);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
  }
});
