# Backend Tests

## Storage Layer Tests

The `storage.test.ts` file contains comprehensive integration tests for the database storage layer.

### Running Tests

**Prerequisites:**
- A PostgreSQL database must be available
- `DATABASE_URL` environment variable must be set

**To run tests:**

```bash
# Set up test database URL
export DATABASE_URL="postgresql://user:password@localhost:5432/testdb"

# Run tests
npm test server/__tests__/storage.test.ts
```

### Test Coverage

The storage tests cover:

**User Operations:**
- Create user
- Get user by ID
- Get user by email
- Update user data
- Verification token management
- Password reset token management

**Profile Operations:**
- Create bio page
- Get profile by page name
- Get profile by ID
- Get all profiles by user ID
- Update bio page
- Set default bio page
- Increment profile views

**Social Links Operations:**
- Create social link
- Get social links by profile ID
- Update social link
- Increment link clicks
- Delete social link

**Theme Operations:**
- Create theme
- Activate theme
- Get theme by ID
- Delete theme

### Notes

- These are **integration tests** that require a real database connection
- Tests clean up after themselves to avoid data pollution
- For CI/CD, use a separate test database
- Consider adding unit tests with mocked dependencies for faster test runs
