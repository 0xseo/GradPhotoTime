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
- Floating `+`: create event or open the access-code entry flow depending on the active tab; hidden while creating a new event
- Screens: native month calendar, host event list, joined reservation list, account/auth, event creation, unified code entry, Host event management, Guest event reservation, and reservation-code management

## Implemented Native Flows

- Email/password sign in and sign up through mobile API routes
- SecureStore session persistence with refresh-token retry
- Dashboard pull-to-refresh for hosted events, joined reservations, calendar markers, and calendar-to-detail navigation
- Event creation with synced date inputs, drag/tap calendar range selection, daily time range, and buffer settings
- Code lookup for event codes and reservation management codes with immediate navigation to the matching screen; event codes open an existing owned/participating reservation when one is already pending or approved
- Host event management with confirmed/pending lists, approve/unconfirm, event deletion, in-app date/default-time edits, date navigation, read-only schedule calendar, and draft-save drag availability editing
- Guest event reservation creation with drag-based 30-minute candidate selection, candidate priority reordering, and reservation management code display
- Reservation-code management with participant/headcount edits, drag-based pending candidate edits, candidate priority reordering, password checks, cancellation, update labeling, and unsaved-change leave warnings

## Remaining Mobile Work

- Confirmed-slot resize/move and buffer add/remove/resize for Host management
- QR/deep-link support with iOS Universal Links and Android App Links
