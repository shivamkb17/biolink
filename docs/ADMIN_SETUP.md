# Admin Dashboard Setup Guide

## Overview

The LinkBoard Admin Dashboard provides a comprehensive interface for managing users, profiles, and viewing system analytics.

## Features

### 📊 Dashboard Overview
- **System Statistics**: Total users, profiles, links, and recent growth metrics
- **Recent Users**: View the latest registered users (last 7 days)
- **Top Profiles**: See most viewed profiles with engagement metrics

### 👥 User Management
- View all users with pagination
- Search and filter users
- Toggle admin privileges
- Delete users (with confirmation)
- View user verification status
- See registration dates

### 📄 Profile Management
- View all bio profiles
- Monitor profile views and link clicks
- Access profiles directly from admin panel
- See default vs secondary profiles
- Track profile creation dates

## Access

### Routes
- `/admin` - Dashboard overview
- `/admin/users` - User management
- `/admin/profiles` - Profile management

## Creating an Admin User

### Option 1: Database Update (Recommended)

Update an existing user to admin via SQL:

```sql
UPDATE users
SET is_admin = true
WHERE email = 'your-email@example.com';
```

### Option 2: During Email Verification

Modify the `server/auth.ts` file temporarily to set admin status on first user:

```typescript
// In the verify-email endpoint, after user creation:
await storage.updateUser(user.id, {
  isEmailVerified: true,
  isAdmin: true,  // Add this line for first user
  emailVerificationToken: null,
  emailVerificationExpires: null,
});
```

**Important**: Remove this change after creating the first admin!

### Option 3: Create Admin Setup Script

Create a one-time setup script:

```bash
# Run this command to make a user admin
NODE_ENV=development tsx -e "
import { storage } from './server/storage.ts';

const email = process.argv[1];
const user = await storage.getUserByEmail(email);

if (user) {
  await storage.updateUser(user.id, { isAdmin: true });
  console.log('✅ User is now an admin');
} else {
  console.log('❌ User not found');
}
" your-email@example.com
```

## Database Migration

The admin feature requires a schema update. Run:

```bash
npm run db:push
```

This adds the `is_admin` column to the `users` table.

## Security Considerations

### Admin Middleware

All admin routes are protected by the `isAdmin` middleware which:
1. Verifies user is authenticated
2. Confirms user has `isAdmin: true` flag
3. Returns 403 Forbidden for non-admin users

### Admin Operations

- **Cannot delete yourself**: Prevents accidental account deletion
- **Cannot remove own admin status**: Prevents loss of admin access
- **Confirmation dialogs**: All destructive actions require confirmation
- **Audit trail**: All user deletions are logged

## Design Flow

### Professional Layout

The admin dashboard follows modern admin panel design principles:

1. **Sidebar Navigation**
   - Persistent left sidebar (collapsible on mobile)
   - Clear icon-based navigation
   - Active state indicators
   - Logout button at bottom

2. **Content Area**
   - Clean, spacious layout
   - Card-based components
   - Responsive grid system
   - Professional typography

3. **Data Tables**
   - Sortable columns
   - Pagination support
   - Action buttons (edit, delete)
   - Status badges
   - Responsive design

4. **Statistics Cards**
   - Color-coded metrics
   - Icon indicators
   - Large, readable numbers
   - Contextual colors

### Mobile Responsive

- Hamburger menu on mobile
- Stacked layout for small screens
- Touch-friendly buttons
- Optimized table scrolling

## API Endpoints

### GET /api/admin/stats
Returns dashboard statistics including user counts, profile metrics, recent users, and top profiles.

**Response:**
```json
{
  "stats": {
    "totalUsers": 150,
    "totalProfiles": 200,
    "totalLinks": 1500,
    "recentUsersCount": 12
  },
  "recentUsers": [...],
  "topProfiles": [...]
}
```

### GET /api/admin/users?page=1&limit=20
Returns paginated list of all users.

### GET /api/admin/profiles?page=1&limit=20
Returns paginated list of all profiles.

### DELETE /api/admin/users/:id
Deletes a user and all their profiles (admin only).

### PATCH /api/admin/users/:id/admin
Toggle admin status for a user.

**Request:**
```json
{
  "isAdmin": true
}
```

## Troubleshooting

### "Admin access required" error
- Ensure your user has `is_admin: true` in the database
- Check that you're logged in with the correct account
- Verify the database migration was applied

### Cannot see admin panel
- Admin routes are `/admin`, `/admin/users`, `/admin/profiles`
- Must be logged in as an admin user
- Check browser console for errors

### Changes not reflecting
- Clear browser cache
- Check database connection
- Verify migrations are up to date

## Best Practices

1. **Limit Admin Users**: Only grant admin access to trusted individuals
2. **Regular Monitoring**: Review user activity periodically
3. **Backup Before Deletes**: Ensure database backups before bulk operations
4. **Test in Development**: Always test admin operations in dev environment first
5. **Use Confirmation Dialogs**: Never bypass deletion confirmations

## Future Enhancements

Potential features to add:
- Activity logs and audit trail
- Bulk user operations
- Advanced search and filtering
- User impersonation (for support)
- Email management
- System settings configuration
- Analytics charts and graphs
- Export data to CSV
- Role-based permissions (beyond admin/user)

## Support

For issues or questions about the admin dashboard, please refer to:
- Main README.md
- GitHub Issues
- Contributing Guide
