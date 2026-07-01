# GradPhotoTime

Graduation photo scheduling app for Hosts and Guests. The web app is built with Next.js App Router and Supabase, and the mobile app is an Expo native React Native client that talks to dedicated Next.js mobile API routes.

## Getting Started

Run the web app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Mobile App

The Expo mobile client lives in `mobile/`. It uses native React Native screens with bottom tabs, SecureStore session persistence, pull-to-refresh dashboard data, and a floating `+` action button.

```bash
cd mobile
npm install
npm run android:local
```

By default the mobile app calls `https://grad-photo-time.vercel.app`. Override it with `EXPO_PUBLIC_API_BASE_URL` when testing a local API.

Current native mobile coverage includes email/password auth, dashboard/calendar data with event/reservation drill-down, source-aware detail back navigation, upcoming/past schedule toggles, event creation with synced date inputs, tap/drag active-date activation/deactivation, 0시/자정 default-time presets, immediate code routing, Host event management, in-app event date/default-time editing, event deletion, draft-save Host availability editing, Host approve/unconfirm actions, tap/drag Guest event reservation creation with priority reordering, reservation-code management, unsaved-change leave warnings, and month/date navigation controls.

## Verification

Useful checks before pushing:

```bash
npm run typecheck
npm run lint
npm test
npm run build

cd mobile
npx tsc --noEmit
npx expo export --platform android --output-dir /private/tmp/gradphoto-mobile-export
```

## Notes

- `.env.local` is required for Supabase web/API secrets and is intentionally gitignored.
- Mobile QR/deep-link behavior is not configured yet; add iOS Universal Links and Android App Links after app IDs/domains are final.
- Phone/SMS auth remains deferred until a paid SMS provider and rate-limit policy are chosen.

## Deploy

Deploy the Next.js app on Vercel and configure Supabase auth redirect URLs for the production domain.
