# TODO

## Auth & Access

- Restrict event creation to authenticated users only. (Implemented in Server Actions and UI gate.)
- Web auth: support email-based sign up/sign in. (Implemented with email verification and password login.)
- Web auth: keep phone number verification deferred until a paid SMS provider and rate-limit policy are chosen.
- Korean production SMS option: evaluate Supabase Send SMS Auth Hook with a domestic provider such as Solapi/CoolSMS or Naver SENS.
- Mobile app auth: add Kakao SDK sign in for the Expo/WebView package.
- Mobile app auth: add Google SDK sign in for the Expo/WebView package.
- Keep guest reservation access code flows available for non-member participants. (Implemented for view/edit/cancel.)

## Implemented PRD Steps

- Step 3: Zustand state structure and drag time selection domain logic.
- Step 4: Server Actions for events, time blocks, event code lookup, reservations, and Host approval.
- Step 5: Mobile-first Host and Guest UI implementation.
- Event creation availability setup: Host selects date range, day bounds, and initial available time blocks in the drag grid.

## Next

- Add automated tests for buffer-time conflict checks and reservation code management. (Started with reservation rule unit tests.)
- Add deployment configuration and Supabase production redirect URLs.
- Package Expo WebView shell after web flow stabilizes. (Scaffolded in `mobile/` with native bottom tabs, WebView routes, and floating action button.)
- Mobile deep links: when production domain/app IDs are ready, configure iOS Universal Links and Android App Links so QR/event links open the app when installed and web otherwise.
