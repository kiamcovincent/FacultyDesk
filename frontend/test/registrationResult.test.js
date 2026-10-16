import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getRegistrationOutcome } from '../src/services/registrationResult.js';

test('confirmation-required registration stays unauthenticated and returns the email to display', () => {
  const outcome = getRegistrationOutcome(
    { confirmationRequired: true },
    ' TEACHER@EXAMPLE.TEST '
  );

  assert.deepEqual(outcome, {
    pendingConfirmation: true,
    email: 'teacher@example.test',
    user: null,
  });
});

test('existing authenticated registration responses remain compatible', () => {
  const user = { id: 'legacy-user-id', role: 'teacher' };
  const outcome = getRegistrationOutcome({ user }, 'teacher@example.test');

  assert.deepEqual(outcome, { pendingConfirmation: false, email: null, user });
});

test('malformed successful registration responses are not treated as authenticated', () => {
  assert.throws(() => getRegistrationOutcome({}, 'teacher@example.test'), /did not include/);
});