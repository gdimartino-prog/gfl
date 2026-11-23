import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResetEmailContent,
  buildResetUrl,
  escapeEmailHtml,
  generateResetToken,
  hashResetToken,
  isPlausibleEmail,
  isResetAllowedLeague,
  isValidResetTokenFormat,
  isWithinCooldown,
  MAX_POSTGRES_INT4,
  normalizeIdentifier,
  parseResetLeagueId,
  redactEmailAddresses,
  RESET_COOLDOWN_MS,
  validateNewPassword,
} from '../lib/passwordResetRules';

test('generateResetToken produces unique base64url tokens and deterministic SHA-256 hashes', () => {
  const first = generateResetToken();
  const second = generateResetToken();

  assert.notEqual(first.rawToken, second.rawToken);
  assert.notEqual(first.tokenHash, second.tokenHash);
  assert.equal(isValidResetTokenFormat(first.rawToken), true);
  assert.equal(first.tokenHash, hashResetToken(first.rawToken));
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
});

test('isValidResetTokenFormat rejects malformed, short, whitespace, and non-string tokens', () => {
  assert.equal(isValidResetTokenFormat(null), false);
  assert.equal(isValidResetTokenFormat(12345), false);
  assert.equal(isValidResetTokenFormat(''), false);
  assert.equal(isValidResetTokenFormat('short-token'), false);
  assert.equal(isValidResetTokenFormat('a'.repeat(31)), false);
  assert.equal(isValidResetTokenFormat('a'.repeat(129)), false);
  assert.equal(isValidResetTokenFormat('a'.repeat(32) + ' '), false);
  assert.equal(isValidResetTokenFormat('a'.repeat(32) + '?bad=1'), false);
  assert.equal(isValidResetTokenFormat('aA0_-'.repeat(8)), true);
});

test('validateNewPassword enforces 8..72 byte bounds and rejects leading/trailing spaces', () => {
  assert.equal(validateNewPassword(null).ok, false);
  assert.equal(validateNewPassword('1234567').ok, false);
  assert.equal(validateNewPassword(' 12345678').ok, false);
  assert.equal(validateNewPassword('12345678 ').ok, false);
  assert.equal(validateNewPassword('a'.repeat(73)).ok, false);
  // 19 4-byte emoji = 76 UTF-8 bytes even though string length is 38 UTF-16 code units
  assert.equal(validateNewPassword('🏈'.repeat(19)).ok, false);

  const valid = validateNewPassword('Pass word!8');
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.value, 'Pass word!8');

  assert.equal(validateNewPassword('a'.repeat(72)).ok, true);
});

test('parseResetLeagueId and isResetAllowedLeague exclude Demo league 2 and invalid IDs', () => {
  assert.equal(parseResetLeagueId(1), 1);
  assert.equal(parseResetLeagueId('3'), 3);
  assert.equal(parseResetLeagueId(' 10 '), 10);
  assert.equal(parseResetLeagueId(MAX_POSTGRES_INT4), MAX_POSTGRES_INT4);
  assert.equal(parseResetLeagueId(MAX_POSTGRES_INT4 + 1), null);
  assert.equal(parseResetLeagueId('9999999999'), null);
  assert.equal(parseResetLeagueId(0), null);
  assert.equal(parseResetLeagueId(-1), null);
  assert.equal(parseResetLeagueId('1abc'), null);
  assert.equal(parseResetLeagueId('2.5'), null);
  assert.equal(parseResetLeagueId(null), null);

  assert.equal(isResetAllowedLeague(1), true);
  assert.equal(isResetAllowedLeague(3), true);
  assert.equal(isResetAllowedLeague(2), false);
  assert.equal(isResetAllowedLeague(0), false);
  assert.equal(isResetAllowedLeague(-5), false);
});

test('isWithinCooldown enforces 3-minute resend window', () => {
  const now = new Date('2026-11-22T20:00:00.000Z');
  const recent = new Date(now.getTime() - RESET_COOLDOWN_MS + 1000);
  const exact = new Date(now.getTime() - RESET_COOLDOWN_MS);
  const older = new Date(now.getTime() - RESET_COOLDOWN_MS - 1000);

  assert.equal(isWithinCooldown(recent, now), true);
  assert.equal(isWithinCooldown(exact, now), false);
  assert.equal(isWithinCooldown(older, now), false);
  assert.equal(isWithinCooldown(null, now), false);
  assert.equal(isWithinCooldown(undefined, now), false);
});

test('normalizeIdentifier, isPlausibleEmail, and redactEmailAddresses enforce safety rules', () => {
  assert.equal(normalizeIdentifier('  NYG  '), 'NYG');
  assert.equal(normalizeIdentifier('   '), null);
  assert.equal(normalizeIdentifier(null), null);
  assert.equal(normalizeIdentifier('x'.repeat(257)), null);

  assert.equal(isPlausibleEmail('coach@example.com'), true);
  assert.equal(isPlausibleEmail(' coach@example.com '), true);
  assert.equal(isPlausibleEmail('coach@example.com\r\nBcc:evil@x.com'), false);
  assert.equal(isPlausibleEmail('coach@example.com,evil@x.com'), false);
  assert.equal(isPlausibleEmail('coach@example.com;evil@x.com'), false);
  assert.equal(isPlausibleEmail('<coach@example.com>'), false);
  assert.equal(isPlausibleEmail('coach @example.com'), false);
  assert.equal(isPlausibleEmail('not-an-email'), false);
  assert.equal(isPlausibleEmail(null), false);

  const rawSmtpErr = '550 5.1.1 <Coach.One+tag@Example.COM> and user@sub.domain: User unknown';
  const redacted = redactEmailAddresses(rawSmtpErr);
  assert.ok(!redacted.includes('Coach.One'));
  assert.ok(!redacted.includes('user@sub.domain'));
  assert.ok(redacted.includes('[redacted-email]'));
});

test('buildResetUrl strips trailing slashes and encodes token', () => {
  assert.equal(
    buildResetUrl('https://afl.gddevco.com///', 'abc_123-XYZ'),
    'https://afl.gddevco.com/reset-password?token=abc_123-XYZ',
  );
});

test('buildResetEmailContent escapes HTML entities and includes reset URL and TTL', () => {
  assert.equal(escapeEmailHtml('<script>"\'&'), '&lt;script&gt;&quot;&#39;&amp;');

  const email = buildResetEmailContent({
    leagueName: 'GFL <2026>',
    teamName: 'New York "Giants"',
    coachName: '<img src=x onerror=alert(1)>',
    resetUrl: 'https://afl.gddevco.com/reset-password?token=testToken123',
    ttlMinutes: 30,
  });

  assert.equal(email.subject, 'GFL <2026> Password Reset — New York "Giants"');
  assert.ok(!email.html.includes('<script>'));
  assert.ok(!email.html.includes('<img '));
  assert.ok(email.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(email.html.includes('GFL &lt;2026&gt;'));
  assert.ok(email.html.includes('New York &quot;Giants&quot;'));
  assert.ok(email.html.includes('https://afl.gddevco.com/reset-password?token=testToken123'));
  assert.ok(email.html.includes('30 minutes'));
  assert.ok(email.text.includes('https://afl.gddevco.com/reset-password?token=testToken123'));
  assert.ok(email.text.includes('30 minutes'));
});
