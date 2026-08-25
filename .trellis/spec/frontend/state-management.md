# State Management

No Redux/Zustand. `App.tsx` holds session user and the running `TimeEntry`. Pages fetch on mount via `api.ts` (`credentials: "same-origin"`).

401 (except `GET /api/auth/me` boot) calls `setOnUnauthorized` and returns to login.
