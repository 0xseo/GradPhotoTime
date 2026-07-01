# TODO

## Auth & Access

- Restrict event creation to authenticated users only. (Implemented in Server Actions and UI gate.)
- Web auth: support email-based sign up/sign in. (Implemented with email verification and password login.)
- Web auth: keep phone number verification deferred until a paid SMS provider and rate-limit policy are chosen.
- Korean production SMS option: evaluate Supabase Send SMS Auth Hook with a domestic provider such as Solapi/CoolSMS or Naver SENS.
- Mobile app auth: email/password auth is implemented through native screens and mobile API routes.
- Mobile app auth: add Kakao SDK sign in after the native app identity is finalized.
- Mobile app auth: add Google SDK sign in after the native app identity is finalized.
- Keep guest reservation access code flows available for non-member participants. (Implemented for view/edit/cancel.)

## Implemented PRD Steps

- Step 3: Zustand state structure and drag time selection domain logic.
- Step 4: Server Actions for events, time blocks, event code lookup, reservations, and Host approval.
- Step 5: Mobile-first Host and Guest UI implementation.
- Event creation availability setup: Host selects date range, day bounds, and initial available time blocks in the drag grid.
- Mobile native app: auth/session persistence, dashboard data, calendar-to-detail navigation, event creation, code lookup, Host event management, draft-save Host availability editing, Host review actions, drag-based Guest event reservation creation with priority reordering, reservation-code management, and month/date navigation are implemented.

## Next

- Add deployment configuration and Supabase production redirect URLs.
- Mobile Host management: add confirmed-slot resize/move and buffer add/remove/resize.
- Mobile deep links: when production domain/app IDs are ready, configure iOS Universal Links and Android App Links so QR/event links open the app when installed and web otherwise.
- QR sharing: generate event QR codes after deep-link targets are finalized.
- Add mobile API tests for reservation creation and Host availability editing.
