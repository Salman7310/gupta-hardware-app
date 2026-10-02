import { phoneProblem } from '../phone';

describe('a typed phone number', () => {
  it('takes a mobile, a landline with its code, and a country code', () => {
    expect(phoneProblem('98765 43210')).toBeNull();
    expect(phoneProblem('06534-222333')).toBeNull();
    expect(phoneProblem('+91 98765 43210')).toBeNull();
    expect(phoneProblem('')).toBeNull();
  });

  /** "Enter it in digits" told someone who had typed digits nothing. */
  it('says a short number is too short', () => {
    expect(phoneProblem('12345')).toBe('That number is too short. A mobile number has 10 digits.');
  });

  it('says a long number is too long', () => {
    expect(phoneProblem('1234567890123456')).toBe(
      'That number is too long. A mobile number has 10 digits.',
    );
  });

  it('asks for digits only when there are letters', () => {
    expect(phoneProblem('ring the shop')).toBe('Use digits only, for example 98765 43210.');
  });
});
