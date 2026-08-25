# Hook Guidelines

No custom hooks library yet. Keep data in page state + `App` for `user` / running timer.

Elapsed ticks with `setInterval` in `App` while a timer is running. Do not persist elapsed; always `now - startedAt`.
