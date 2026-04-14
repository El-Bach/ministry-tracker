# Ministry Tracker — Setup Guide

Internal government clearing file management system for cross-platform mobile (iOS + Android).

---

## Stack

| Layer | Technology |
|---|---|
| Framework | React Native (Expo ~51) |
| Backend / DB | Supabase (free tier) |
| Auth | Supabase Auth (email/password) |
| Realtime | Supabase Realtime (postgres_changes) |
| Push | Expo Notifications |
| GPS | Expo Location |
| Calendar | react-native-calendars |
| Offline | Zustand + AsyncStorage queue |
| Navigation | React Navigation v6 |

---

## 1. Supabase Setup

1. Create a project at https://supabase.com
2. Go to **SQL Editor** and run the full contents of `supabase/schema.sql`
3. Copy your project **URL** and **anon key** from:
   `Project Settings → API → Project URL & anon public key`
4. Paste them into `src/lib/supabase.ts`:

```ts
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```

---

## 2. Create Team Member Accounts

Each employee needs:
1. A **Supabase Auth** account (go to `Authentication → Users → Invite user`)
2. A matching row in the `team_members` table with the **same email**

You can insert team members via SQL:

```sql
INSERT INTO team_members (name, role, email)
VALUES ('Ahmad Khalil', 'Senior Agent', 'ahmad@company.com');
```

Or use the Settings screen inside the app (after first user is set up).

> **Note:** The app's Settings screen inserts the `team_members` profile row only.
> You must also create the Supabase Auth user separately (via dashboard or Edge Function).
> In production, wrap both steps in a Supabase Edge Function for one-click member creation.

---

## 3. Install & Run

```bash
# Install dependencies
npm install

# Start Expo dev server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

---

## 4. Build for Distribution (internal)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure project (first time)
eas build:configure

# Build for internal distribution
eas build --platform all --profile preview
```

Add an `eas.json`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "ios": { "simulator": false },
      "android": { "buildType": "apk" }
    }
  }
}
```

---

## 5. Permissions Required

| Permission | Platform | Purpose |
|---|---|---|
| Location (when in use) | iOS + Android | GPS stamp on status updates |
| Calendar | iOS + Android | Show tasks as calendar events |
| Notifications | iOS + Android | Push alerts on assignment/status |

---

## 6. Offline Behavior

When the device has no internet:
- Status updates are queued in AsyncStorage via Zustand store
- A banner at the top shows "Offline — N updates queued"
- When connection restores, all queued actions sync automatically
- Comments work the same way

---

## 7. Realtime

Three tables have Supabase Realtime enabled:
- `tasks` — assignment changes, status changes
- `task_route_stops` — per-stop status changes
- `task_comments` — new comments

Any update by any team member instantly refreshes all other users' screens.

---

## 8. Screen Reference

| Screen | Tab | Path |
|---|---|---|
| Dashboard | ⊞ Dashboard | DashboardHome |
| New File | — | Dashboard → NewTask |
| File Detail | — | Dashboard → TaskDetail |
| Calendar | ◫ Calendar | CalendarScreen |
| Team | ◉ Team | TeamScreen |
| Settings | ⚙ Settings | SettingsScreen |

---

## 9. Data Model Quick Reference

```
clients          — name, client_id, phone
ministries       — name, type (parent/child), parent_id
services         — name, ministry_id, estimated_duration_days
tasks            — client, service, assignee, status, due_date, notes
task_route_stops — task, ministry, stop_order, status, gps, updated_by
task_comments    — task, author, body, gps
status_updates   — audit log of all status changes
status_labels    — user-defined status names + colors
team_members     — name, role, email, avatar_url
```

---

## 10. Configuring Lists (no code required)

All dropdowns are editable from **Settings → ⚙**:
- Add / delete ministries and sub-ministries
- Add / delete services (linked to a ministry)
- Add / delete status labels (with custom hex color)
- Add / delete team members

No app update required for any list change.
