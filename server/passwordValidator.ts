/**
 * Password validation utilities
 * Enforces strong password requirements for security
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates password strength with the following requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character (@$!%*?&)
 *
 * @param password - The password to validate
 * @returns Validation result with errors if any
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Minimum length check
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // Maximum length check (prevent DoS via bcrypt)
  if (password.length > 72) {
    errors.push("Password must be less than 72 characters");
  }

  // Uppercase letter check
  if (!/[A-Z]/.test(password)) {
    errors.push("Password must contain at least one uppercase letter");
  }

  // Lowercase letter check
  if (!/[a-z]/.test(password)) {
    errors.push("Password must contain at least one lowercase letter");
  }

  // Number check
  if (!/[0-9]/.test(password)) {
    errors.push("Password must contain at least one number");
  }

  // Special character check
  if (!/[@$!%*?&]/.test(password)) {
    errors.push("Password must contain at least one special character (@$!%*?&)");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Gets a user-friendly password requirements message
 */
export function getPasswordRequirements(): string {
  return "Password must be 8-72 characters and include: uppercase letter, lowercase letter, number, and special character (@$!%*?&)";
}
