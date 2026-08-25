# Type Safety

Types for API payloads live next to the client in `web/src/api.ts` (`User`, `Category`, `TimeEntry`, `TodayEntries`, `TodayStats`). Instants are `string` ISO-Z. `stoppedAt: string | null`.

Do not parse dates as naive local strings. Format with `format.ts` + browser IANA zone.
