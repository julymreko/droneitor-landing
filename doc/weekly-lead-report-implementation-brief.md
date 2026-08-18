# Droneitor Weekly Lead Executive Report

## Implementation brief for an AI coding model

You are working on the **Droneitor Landing** project at `fly.droneitor.com`.
The application runs on **Cloudflare Workers and Pages**, stores leads in a
**Cloudflare D1** database, copies them to Google Sheets, and sends email through
**ZeptoMail**.

Build a production-ready weekly executive lead report and its ZeptoMail email
template. The report is an internal business email for Droneitor and Tu Digital
Marketing. It is **not** sent to the people who submit the landing-page form.

Before making changes, inspect the existing repository, D1 schema, Worker
bindings, email utilities, naming conventions, and deployment configuration.
Reuse the existing ZeptoMail integration and helpers where practical. Do not
invent a second email client when one already exists.

---

## 1. Business objective

Every week, summarize the leads captured by `fly.droneitor.com` so the recipients
can quickly understand:

1. How many leads arrived?
2. Which project types generated demand?
3. Which campaigns and channels generated the leads?
4. Where did the leads come from?
5. On which days and devices did they submit the form?
6. Who are the leads that require follow-up?

The email must be concise, executive, data-driven, easy to scan, and useful for
campaign decision-making. It must not look like a database dump.

---

## 2. Schedule and reporting window

Implement the report as a **Cloudflare Cron Trigger**.

- Reporting period: Monday at `00:00:00` through Sunday at `23:59:59`, in Miami
  local time.
- IANA timezone: `America/New_York`.
- Do not use `America/Chicago` and do not hard-code EST or EDT. Miami observes
  daylight-saving time.
- Internally, calculate a half-open UTC interval:
  `[Monday 00:00 Miami, following Monday 00:00 Miami)`.
- Query D1 using that UTC interval so boundary records are not omitted or counted
  twice.
- Run the cron after the reporting week has closed. A recommended time is Monday
  shortly after midnight in Miami, converted appropriately for the Cloudflare
  cron schedule, which is expressed in UTC.
- The report must describe the completed week, not the new week that has just
  started.
- If the completed week contains **zero leads**, do not send an email.
- If there is **at least one lead**, generate and send exactly one report.
- Make execution idempotent so a cron retry does not send the same weekly report
  twice. Reuse an existing job/audit mechanism if available; otherwise propose a
  small report-delivery table or an equivalent durable approach keyed by the
  reporting period.

Log a structured result for each execution, including the reporting interval,
lead count, whether an email was sent or skipped, environment, and ZeptoMail
request/message identifier. Do not log private lead values or secrets.

---

## 3. Sender and recipients

Use this verified ZeptoMail sender:

- From address: `support@droneitor.com`
- Recommended display name: `Droneitor Reports`

### Test mode

During development and approval, send the report **only** to:

- Julian Cely / 2DM: `cj.cely@hotmail.com`

Marco must not receive any development, preview, seed-data, or test message.

### Production mode, only after approval

After the report has been approved, configure the production recipients as:

- Marco Beas / Droneitor: `droneitor1983@gmail.com`
- Julian Cely / 2DM: `cj.cely@hotmail.com`

Do not scatter recipient addresses through the template or business logic.
Use explicit environment-aware configuration such as:

- `REPORT_MODE=test|production`, or the repository's established environment
  convention.
- `WEEKLY_REPORT_TEST_RECIPIENTS`
- `WEEKLY_REPORT_PRODUCTION_RECIPIENTS`

Default safely: an unset or unknown mode must never select the production
recipient list. Validate recipients before the send call and log only the count
or masked addresses.

---

## 4. Email language and subject

The weekly internal report must always be written in **English**, regardless of
each lead's `lang` value. The `lang` field is used only as an audience metric.

Recommended production subject:

```text
Droneitor | Weekly Lead Report | {period_short} | {total_leads} leads
```

Examples:

```text
Droneitor | Weekly Lead Report | Aug 10–16, 2026 | 12 leads
Droneitor | Weekly Lead Report | Aug 10–16, 2026 | 1 lead
```

For test mode, prepend an unmistakable marker:

```text
[TEST] Droneitor | Weekly Lead Report | Aug 10–16, 2026 | 12 leads
```

Handle singular and plural correctly.

---

## 5. Available lead fields

The current lead records include the following fields. Confirm their exact D1
column names and types before implementing the query:

| Field | Report use |
| --- | --- |
| `lead_id` | Lead reference in the operational directory |
| `name` | Lead identity |
| `email` | Follow-up contact |
| `phone` | Follow-up contact |
| `created_at` | Reporting window, day, and time analysis |
| `project_type` | Demand by service: real-estate, events, construction, other |
| `lang` | English versus Spanish audience distribution |
| `utm_source` | Acquisition source |
| `utm_medium` | Acquisition medium |
| `utm_campaign` | Campaign performance |
| `utm_content` | Optional detailed attribution |
| `utm_term` | Optional detailed attribution |
| `country` | Geographic summary |
| `region` | Geographic summary |
| `city` | Geographic summary |
| `user_agent` | Approximate device classification |
| `ip` | Technical field; do not expose the full value in the weekly report |

Treat empty strings, whitespace-only strings, `null`, and `undefined`
consistently. Use labels such as `Unattributed`, `Unknown`, or `Not provided`,
according to the metric. Never render JavaScript `null` or `undefined` in the
email.

---

## 6. Required report content

### A. Header and reporting context

Include:

- Droneitor weekly report title.
- Completed reporting period.
- `Miami time` as descriptive timezone text.
- Generated timestamp.
- A short introduction addressed to `Marco and Julian` in production, and
  `Julian` in test mode.

Recommended introduction:

```text
Here is Droneitor's lead performance summary for {period_long}. A total of
{total_leads} leads were captured through fly.droneitor.com.
```

### B. Executive KPI row

Show four high-priority metrics:

1. **Total Leads**
2. **Weekly Change** compared with the immediately preceding completed week
3. **Top Project Type** with count
4. **Top Acquisition Source** with count

If location is more useful than weekly change in the final layout, it may appear
as a fifth KPI or immediately below the KPI row as **Top Location**.

Weekly-change rules:

- Query the immediately previous Monday-to-Monday Miami interval.
- If previous count is greater than zero, calculate the percentage change.
- If both weeks are zero, display `No change`.
- If the previous week is zero and the current week is positive, display `New`
  instead of an infinite or misleading percentage.
- Include the actual previous-week count in accessible text or supporting copy.

### C. Executive insight

Generate one short deterministic sentence from the aggregated data; do not call
an LLM at runtime. Example:

```text
Lead volume increased 20% week over week. Real Estate was the leading service,
and Google Ads generated the most leads.
```

The wording must also work for one lead, a decline, no week-over-week change,
and unattributed traffic.

### D. Leads by project type

Display a compact table with:

- Project type
- Lead count
- Percentage of total

Sort by count descending, then by normalized label for deterministic ties.
Normalize known project-type slugs into readable labels, for example
`real-estate` to `Real Estate`. Preserve unexpected values safely as readable
text instead of discarding them.

### E. Campaign performance

Display a table with:

- Source / Medium
- Campaign
- Leads
- Share of total

Also calculate:

- Top source
- Top campaign
- Number and percentage of unattributed leads
- Number and percentage of leads with the core UTM fields available

Normalization requirements:

- Trim whitespace.
- Compare attribution values case-insensitively for grouping.
- Merge variants such as `Google`, `google`, and `GOOGLE`.
- Preserve a clean human-readable label for display.
- A missing `utm_source` is `Direct / Unattributed`.
- A missing campaign is `Not provided`.
- Do not imply that unattributed automatically means organic traffic.

`utm_content` and `utm_term` do not need columns in the executive table. They
may be used in tests and remain available for future drill-down analysis.

### F. Audience and location

Include compact summaries for:

- Language: English, Spanish, Unknown
- Approximate device: Mobile, Desktop, Tablet, Other/Unknown
- Top locations based on city, region, and country

Device classification must be deterministic and derived conservatively from
`user_agent`. It is an approximation, not a source of truth. Do not include the
full user-agent string in the email.

Geolocation derived from IP is approximate. Do not include full IP addresses in
the weekly report. Group missing geography under `Unknown` and avoid awkward
strings such as `null, null, Miami`.

### G. Daily lead activity

Show Monday through Sunday even when some days have zero leads. For each day,
show the lead count and optionally a simple email-safe proportional bar.

Identify the strongest day. When multiple days tie, state that there was a tie
or apply a documented deterministic rule rather than making an unsupported
claim.

Optionally calculate the busiest Miami-time period using these buckets:

- 12:00 AM–5:59 AM
- 6:00 AM–11:59 AM
- 12:00 PM–5:59 PM
- 6:00 PM–11:59 PM

### H. Operational lead directory

Finish with a compact follow-up table containing every lead in the reporting
week, ordered newest first:

- Received date and time in Miami
- Name and Lead ID
- Email and phone
- Project type
- Source or campaign

Make email addresses clickable with `mailto:` and phone numbers clickable with
`tel:` after validating/sanitizing link targets. Render the visible original
contact value safely.

Do not include full IP addresses, raw user agents, or all five UTM fields in this
directory. Escape every database-derived value before inserting it into HTML.

For unusually large weeks, keep the email usable. If the repository has no
external dashboard or export mechanism, include all leads but use compact rows.
Do not silently omit leads. Structure the renderer so a future row limit and CSV
attachment can be added without rewriting aggregation logic.

### I. Footer

Include:

- `Report generated automatically from the Droneitor lead database.`
- `fly.droneitor.com`
- `Miami time`
- A subtle test-mode warning when applicable:
  `TEST REPORT — Generated from non-production sample data.`

Do not add marketing opt-out language because this is an internal operational
email, not a promotional message.

---

## 7. Visual and email-client requirements

Create both an **HTML body** and an equivalent **plain-text body** for
ZeptoMail.

The report must look professional in Gmail, Outlook, Apple Mail, and common
mobile email clients. It must remain readable whether a recipient's device or
email application uses a light or dark preference.

Important: do **not** make the design depend on `prefers-color-scheme`, external
CSS, JavaScript, a remote font, or the recipient's theme setting.

Use these principles:

- Table-based email layout.
- Maximum content width around `680px`.
- Inline CSS for all essential styles.
- System fonts: Arial, Helvetica, sans-serif.
- Explicit background and text colors on the body, wrapper, content panels,
  KPI cards, table cells, and footer.
- High contrast in both normal rendering and clients that partially invert
  colors in dark mode.
- Avoid pure black as the main background and avoid low-contrast gray text.
- Do not place essential text inside images.
- Use solid borders and spacing so sections remain distinguishable if a client
  alters background colors.
- Use accessible text labels in addition to color for positive or negative
  weekly change.
- Ensure KPI cards stack or remain readable on narrow screens.
- Avoid fragile CSS such as grid, flexbox-dependent structure, scripts, forms,
  SVG, canvas, and background images.
- Do not use emoji as business icons or status indicators.
- Include a hidden preheader.
- Add basic email-client meta tags and `x-apple-disable-message-reformatting`.
- Use `role="presentation"` for layout tables, but preserve semantic or
  accessible meaning for data where practical.

Suggested palette:

| Purpose | Color |
| --- | --- |
| Navy / dark | `#152945` |
| Terracotta accent | `#c9603c` |
| White | `#ffffff` |
| Page background | `#f3f5f7` |
| Divider | `#d7dce2` |
| Secondary text | `#4b5563` |
| Positive text, if used | A dark accessible green |
| Negative text, if used | A dark accessible red |

Use the palette as guidance, but verify contrast. The report should have a
light, neutral primary canvas with strong navy headers and terracotta accents,
because this is more resilient across email-client theme transformations than
a design that assumes a fully dark background.

Do not load assets from a CDN. If the existing project already injects an
approved inline logo through ZeptoMail CID, reuse its established CID and
attachment mechanism. The report must still be understandable if images are
blocked.

---

## 8. ZeptoMail integration

Use the project's existing ZeptoMail transactional-email mechanism and secret
binding. Never hard-code or print the ZeptoMail token.

The payload must include:

- Sender: `support@droneitor.com`
- Environment-aware recipient list
- Subject
- HTML body
- Plain-text body
- Existing inline images only if the project already supports them

Handle non-2xx responses, timeouts, and malformed responses. Do not mark a
report as delivered until ZeptoMail accepts the request successfully. Preserve
enough delivery metadata to diagnose failures without storing credentials or
unnecessary personal data.

Do not retry indiscriminately inside the same invocation. Coordinate retry
behavior with the idempotency mechanism so a transient failure can be retried
without duplicate delivery.

---

## 9. D1 aggregation and architecture

Separate concerns so each part can be tested independently:

1. Reporting-window calculation
2. D1 data retrieval
3. Normalization
4. Aggregation
5. Executive-insight generation
6. HTML rendering
7. Plain-text rendering
8. Recipient resolution
9. ZeptoMail delivery
10. Delivery/idempotency recording

Prefer clear named objects over replacing dozens of string placeholders with
unstructured chained calls. All rendered lead values must be escaped for their
HTML context, and URL attributes must be sanitized separately.

Do not alter the production lead schema merely to make aggregation convenient.
If an index is necessary, explain and implement the smallest safe migration,
typically an index on `created_at`, after confirming the real table and column.

Use stable rounding rules so percentages sum sensibly and no `NaN`, `Infinity`,
or negative zero appears.

---

## 10. Dummy D1 test data

Create a **reversible, non-production seed mechanism** that inserts enough dummy
records to exercise the complete report.

First inspect the real D1 schema. Adapt the seed statements to the actual table,
required columns, primary-key behavior, timestamp representation, and
constraints. Do not guess and do not run the seed against the production D1
database.

Requirements:

- Use a dedicated local or preview D1 database.
- Seed approximately 12–16 records within one known completed Monday-to-Sunday
  reporting interval.
- Add a recognizable marker if the schema has a safe field for it, or keep a
  deterministic list/range of test IDs so cleanup is exact.
- Provide a cleanup command or SQL script that removes only the seeded records.
- Never use a broad delete statement.
- Never trigger the normal individual-lead welcome or notification emails while
  seeding.
- Never copy seed records into the production Google Sheet.
- Never send a seeded report to Marco.

The sample dataset must cover:

- Several project types: Real Estate, Events, Construction, Other
- English and Spanish leads
- Google CPC, Instagram paid social, Facebook paid social, and direct or missing
  attribution
- Mixed capitalization and surrounding whitespace in UTM values to test
  normalization
- At least one missing campaign
- At least one record with all UTM fields missing
- Miami and other Florida cities
- At least one unknown or partial location
- Desktop, mobile, tablet, and unusual/unknown user-agent examples
- Leads across all seven days, with at least one zero-lead day if the chosen
  total permits it
- More than one lead on the busiest day
- Records close to the opening and closing boundaries of the reporting interval
- At least one prior-week dataset so weekly comparison can be verified
- Null and empty optional fields
- Long but safe names or campaign values to test wrapping
- No real personal information; use reserved domains such as `example.com` and
  obviously fictitious phone numbers

Use deterministic timestamps rather than `CURRENT_TIMESTAMP` so screenshots and
assertions are reproducible. Provide the exact command to run the report for the
seeded week without waiting for the real cron schedule.

---

## 11. Testing workflow

Implement or document this approval flow:

1. Run unit tests for time-window boundaries, DST-sensitive dates,
   normalization, aggregation, percentages, pluralization, HTML escaping,
   device classification, and zero-lead behavior.
2. Create or reset the local/preview D1 database.
3. Apply migrations.
4. Insert deterministic dummy leads.
5. Generate the HTML and plain-text report locally without sending it.
6. Save a preview artifact if the repository's workflow supports it.
7. Send a ZeptoMail test message only to `cj.cely@hotmail.com` with `[TEST]` in
   the subject.
8. Verify rendering in both light and dark OS/email preferences, on desktop and
   a narrow mobile viewport.
9. Verify links, counts, grouping, week boundaries, missing values, previous-week
   comparison, and plain-text fallback.
10. Clean up the seed data.
11. Keep production recipients disabled until explicit approval is received.
12. After approval, enable Marco and Julian in production configuration and
    perform a final configuration check without using sample data.

Sending a real email is an external side effect. Provide a dry-run mode and do
not send unless the person executing the implementation explicitly invokes the
send/test command.

---

## 12. Required deliverables

Return the implementation in the repository's existing language and structure.
At minimum provide:

1. Weekly-report HTML template or renderer
2. Equivalent plain-text renderer
3. Weekly aggregation/query module
4. Miami reporting-window utility
5. Cloudflare scheduled-handler integration
6. Environment-aware recipient configuration
7. ZeptoMail send integration
8. Idempotency/delivery-record mechanism
9. D1 dummy-data seed script
10. Exact seed cleanup script
11. Dry-run or local preview command
12. Explicit test-send command
13. Automated tests for critical logic
14. Short README explaining local test, preview, test send, cleanup, and
    production enablement

If the repository has established filenames, test frameworks, or command
conventions, follow them. Otherwise, sensible names include:

```text
src/email/weekly-lead-report-template.js
src/reports/weekly-lead-report.js
src/utils/reporting-window.js
scripts/seed-weekly-report.sql
scripts/cleanup-weekly-report-seed.sql
tests/weekly-lead-report.test.js
```

Do not overwrite the existing individual lead notification or the bilingual
lead confirmation email. This weekly report is a separate internal workflow.

---

## 13. Acceptance criteria

The work is complete only when all of the following are true:

- A completed Miami Monday-to-Sunday interval is calculated correctly in UTC.
- DST transitions and interval boundaries are tested.
- Zero leads produces no ZeptoMail send attempt.
- One or more leads produces one report.
- Re-running the same successfully delivered period does not send a duplicate.
- Test mode resolves only Julian's email address.
- Production mode resolves Marco and Julian only after explicit approval.
- The sender is `support@droneitor.com`.
- The report is always in English.
- All executive metrics match the underlying seeded records.
- Previous-week comparison handles a zero baseline safely.
- UTM variants are normalized and unattributed leads are labeled honestly.
- No full IP address or raw user agent is shown in the weekly email.
- All database-derived HTML is escaped.
- HTML and plain-text versions contain equivalent business information.
- The HTML uses email-safe structure and essential inline styles.
- The report remains readable in light and dark preferences without depending
  on theme-detection CSS.
- Seed data is deterministic, non-production, and exactly reversible.
- Seeding sends no individual lead email and writes to no production Sheet.
- A dry run can generate the report without sending it.
- A deliberate test command sends only to Julian and includes `[TEST]`.
- Secrets and full personal lead data are absent from logs.
- Existing lead-capture, D1, Google Sheets, and individual-email flows continue
  to work unchanged.

---

## 14. Expected response from the coding model

Start by summarizing the repository components you found and any schema or
integration assumptions that were confirmed. Then provide a short implementation
plan, make the changes, run the relevant tests, and report:

- Files created or modified
- D1 query and reporting-window behavior
- Seeded test-week dates and expected totals
- Test results
- Dry-run/preview instructions
- Exact test-send instruction
- Exact cleanup instruction
- The explicit configuration change required to enable production recipients

Do not claim that an email was delivered unless the ZeptoMail response confirms
acceptance. Do not enable or contact the production recipient list as part of
development.
