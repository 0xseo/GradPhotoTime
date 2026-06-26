# GradPhotoTime Mobile

Expo native mobile client for GradPhotoTime.

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

The current mobile client is native UI first. Data is still demo-backed until the mobile API layer is connected.

## Navigation

- Bottom tabs: `내 이벤트`, `달력`, `참여한 이벤트`, `My`
- Floating `+`: create event or open the access-code entry flow depending on the active tab
- Screens: native month calendar, host event list, joined reservation list, account shell, event creation, and unified code entry

Later, the native client should call dedicated Next.js API routes or Supabase client helpers instead of WebView pages.
