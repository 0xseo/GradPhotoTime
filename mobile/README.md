# GradPhotoTime Mobile

Expo native React Native client for GradPhotoTime.

## Run

Install dependencies inside `mobile/`:

```bash
npm install
```

Start Expo from `mobile/`:

```bash
npm run android:local
```

Use `npm run ios:local` for the iOS simulator.

By default the app calls `https://grad-photo-time.vercel.app`. For local API testing:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 npm run android:local
```

## Navigation

- Bottom tabs: `내 이벤트`, `달력`, `참여한 이벤트`, `My`
- Floating `+`: create event or open the access-code entry flow depending on the active tab
- Screens: native month calendar, host event list, joined reservation list, account/auth, event creation, unified code entry, Host event management, and Guest event reservation

## Implemented Native Flows

- Email/password sign in and sign up through mobile API routes
- SecureStore session persistence with refresh-token retry
- Dashboard pull-to-refresh for hosted events, joined reservations, and calendar markers
- Event creation with date range, daily time range, and buffer settings
- Code lookup for event codes and reservation management codes
- Host event management with confirmed/pending lists, approve/unconfirm, read-only schedule calendar, and tap-to-toggle availability editing
- Guest event reservation creation with 30-minute candidate selection and reservation management code display

## Remaining Mobile Work

- Reservation management screen for editing participants, candidate slots, and cancellation from a reservation code
- Drag gestures and priority reordering for Guest candidate slots
- Confirmed-slot resize/move and buffer add/remove/resize for Host management
- QR/deep-link support with iOS Universal Links and Android App Links
