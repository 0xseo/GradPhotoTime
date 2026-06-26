# GradPhotoTime Mobile

Expo WebView shell for the existing Next.js scheduling app.

## Run

Install dependencies inside `mobile/`:

```bash
npm install
```

Start the web app from the repository root:

```bash
npm run dev
```

Start Expo from `mobile/`:

```bash
EXPO_PUBLIC_WEB_BASE_URL=http://localhost:3000 npm run ios
```

For a physical phone, use your Mac's LAN IP instead of `localhost`, for example:

```bash
EXPO_PUBLIC_WEB_BASE_URL=http://192.168.0.10:3000 npm run start
```

## Navigation

- Bottom tabs: `내 이벤트`, `달력`, `참여한 이벤트`, `My`
- Floating `+`: create event or open the access-code entry flow depending on the active tab
- The app opens mobile-shell web URLs such as `/?shell=mobile&mobileView=calendar`

Later, the same HTTPS event URLs can be connected to iOS Universal Links and Android App Links.
