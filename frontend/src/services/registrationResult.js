export function getRegistrationOutcome(data, requestedEmail) {
  if (data?.confirmationRequired === true) {
    const email = typeof data.email === 'string' ? data.email : requestedEmail;
    return {
      pendingConfirmation: true,
      email: email.trim().toLowerCase(),
      user: null,
    };
  }

  if (data?.user) {
    return { pendingConfirmation: false, email: null, user: data.user };
  }

  throw new Error('Registration response did not include a user or confirmation status.');
}