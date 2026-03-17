# QA Atlas — Источник данных

Данные в QA Atlas взяты из реального проекта **Enquiry Tracker** (eq-monorepo) и **Jira ET**.

## Откуда данные

| Источник | Путь | Что использовано |
|----------|------|------------------|
| Regression Test Plan | `~/eq-monorepo/docs/plans/2026-02-11-regression-test-plan.md` | 114 тест-кейсов, модули, приоритеты |
| **Jira ET** | enquirytracker.atlassian.net | Тикеты status=QA, labels=regression, E2E тесты (ET-9395, ET-9392, ET-9379, ET-8761, ET-8578, ET-8577, ET-8576, ET-8580 и др.) |
| Angular app | `~/enrollment_angular/src/app/` | Структура модулей |
| Node backend | `~/enrollment_node/` | API, контроллеры |

## Папки (модули)

- **Apply** — формы заявок, Stripe, wizard (P1-APPLY)
- **Students** — студенты, адреса, Zone Catcher (P1-STU)
- **Auth** — WorkOS SSO, email/password (P1-AUTH)
- **Map Layers** — KML, Zone Catcher, геокодинг (P1-MAP)
- **Contact Portal** — подписи, OTP, портал родителей (P1-PORTAL)
- **Family Fields** — Family Type, Family Circumstances (P2-FAM)
- **Class Groups** — годовые уровни, классы (P2-CG)
- **Analytics** — графики, Geographic map (P2-ANA)
- **Lead Score** — критерии, очки (P2-LS)
- **Tasks** — задачи, напоминания (P2-TASK)
- **Export/Import** — CSV, Family Type/Circumstances (P3-CSV)
- **Merge** — слияние студентов (P3-MERGE)
- **Admin** — версия, CSP, School Lists (P3-INFRA)
- **Enquiries** — заявки, фильтры
- **Events** — регистрация на события
- **Comms** — сообщения, Dittofeed

## Релизы

Примеры релизов v26.1.0 с подсветкой затронутых модулей. Jira-тикеты (ET-XXXX) — из реального бэклога.

## Как обновить

1. Редактировать `backend/data/folders.json` и `backend/data/releases.json`
2. Или вызывать API: `POST /api/folder`, `POST /api/item`, `POST /api/releases`
