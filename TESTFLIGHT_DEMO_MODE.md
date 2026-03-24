# TestFlight Demo Mode - Apple Reviewer Instructions

## What Was Changed

I've implemented a **Demo Mode** feature that allows Apple reviewers to access your app without requiring Google OAuth authentication. This addresses Apple's requirement for demo credentials.

### Files Modified:

1. **[app/LoginScreen.jsx](app/LoginScreen.jsx)** - Added "Demo Mode (For Reviewers)" button
2. **[components/AuthContext.jsx](components/AuthContext.jsx)** - Added demo user support with admin privileges
3. **[app/\_layout.jsx](app/_layout.jsx)** - Added demo mode detection and routing
4. **[components/Profile/MenuList.jsx](components/Profile/MenuList.jsx)** - Added demo mode logout support

## How Demo Mode Works

When Apple reviewers tap the **"Demo Mode (For Reviewers)"** button on the login screen:

- They bypass Google OAuth authentication
- They're logged in as a demo user with **admin privileges** (to see all features)
- Demo user info:
  - Name: "Demo Reviewer"
  - Email: demo@reviewermode.com
- They can access all features of your app
- They can exit demo mode by tapping the sign-out button in the Profile tab

## Next Steps for Apple Submission

### 1. Build and Test

```bash
# Build a new TestFlight version
eas build --platform ios --profile production
```

### 2. Update TestFlight Information in App Store Connect

Go to **App Store Connect** → **Your App** → **TestFlight** → **Test Information** → **Beta App Review Information**

**DO NOT check "Sign-in required"** - Instead, add this to the **"Beta App Description"** or **"Notes"** field:

```
DEMO MODE FOR REVIEWERS:

To access the app for review:
1. Launch the app
2. Tap the "Demo Mode (For Reviewers)" button on the login screen
3. You will be logged in automatically with full admin access
4. All features are available for testing
5. To exit demo mode, go to Profile tab and tap sign-out

No additional credentials are required.
```

### 3. Reply to Apple's Message

In App Store Connect, reply to Apple's rejection message with:

```
Hello,

Thank you for your feedback. We have updated the app to include a Demo Mode feature specifically for reviewers.

To access the app:
1. Launch the app
2. On the login screen, tap the "Demo Mode (For Reviewers)" button
3. You will be automatically logged in with full admin privileges

No additional credentials are required. All features are accessible in demo mode.

We have submitted build version [YOUR_NEW_BUILD_NUMBER] with this functionality.

Best regards
```

### 4. Submit for Review

- Make sure your new build (with demo mode) is uploaded to TestFlight
- Submit for beta app review again
- Apple will be able to access all features using the demo mode button

## Testing Demo Mode Yourself

Before submitting to Apple, test the demo mode:

1. Open your app
2. Tap "Demo Mode (For Reviewers)"
3. Verify you can access all features
4. Check that the Profile shows demo user info
5. Test the sign-out button to ensure you can exit demo mode

## Important Notes

- Demo mode gives **admin privileges** so Apple can see all features
- Demo mode data is stored locally and persists across app restarts
- Regular users won't be affected - they can still use Google login normally
- The demo button is always visible (consider hiding it in production if desired)

## If You Want to Hide Demo Mode in Production

If you want the demo button only visible in TestFlight/development, you can add a condition:

```javascript
// In LoginScreen.jsx, wrap the demo button with:
{
  __DEV__ && (
    <TouchableOpacity
      onPress={onDemoPress}
      style={[styles.btn, styles.demoBtn]}
    >
      <Text style={styles.txtBtn}>Demo Mode (For Reviewers)</Text>
    </TouchableOpacity>
  );
}
```

This way it only shows in development/TestFlight builds, not in the production App Store version.
