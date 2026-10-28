# Hourwise

See every price in hours of your work. Type in what something costs and Hourwise tells you how long you'd have to work to pay for it, and what that money could grow into if you invested it instead. Then you choose: **Bye 👋** or **Buy**.

It's a feature-for-feature take on the BuyBye budgeting app, rebuilt as a free, offline web app with no account, no subscription and no tracking.

## Features

**From the original**
- **Worth it? analyzer.** Price → work time ("1 day 2 hrs") and "invested instead" value at retirement. Bye, Buy, or Sleep on it.
- **Savings dashboard.** Money saved, work time saved, and what it would be worth invested.
- **Hourly or salary pay**, any hours per week and days per week (hourly mode for non-40-hour weeks).
- **Monthly budget** with what's left, plus a **work-hours budget view** that shows every amount as time.
- **Track income, expenses, bills and no-buy days.**
- **Optional sales tax** added to prices.
- **Cooldown mode** to pause impulse buys before you decide.
- **Shop Block** (see limits below).
- **Savings goals** for travel, an emergency fund, anything.
- **100 Envelope Challenge.**
- **A pig mascot** (Truffle, rename it) who earns points when you make good money choices. Spend points decorating its room.
- **Daily challenges.** Shake your phone (or tap) for a random money challenge.
- **46 currencies.**

**Added**
- Bills that repeat monthly with paid/overdue status and "safe to spend after bills".
- A daily spending allowance for the rest of the month.
- Insights: spending by category, 6-month trend vs budget, share of your working hours that went to spending, bye-vs-buy rate, biggest purchases.
- Take-home pay mode (subtracts income tax).
- 14 badges, month-end under-budget bonus, points history.
- Cooldown items with links, countdowns, and reminders.
- Backup to JSON, restore from backup, export spending to CSV.
- Share a product page to Hourwise (Android, when installed) and it pulls out the price.
- Light and dark themes, works offline, installable.

## Use it

**Online:** https://vocal101.github.io/hourwise/. Open it on your phone and choose "Add to Home Screen" (iPhone: Share → Add to Home Screen; Android: menu → Install app) to use it like a regular app, offline included.

**On your computer:** download the repo (Code → Download ZIP, or `git clone https://github.com/Vocal101/hourwise.git`). Hourwise uses ES modules, so it needs to be served over HTTP. Double-clicking `index.html` won't work.

```bash
python -m http.server 8776
```

Then open http://localhost:8776. To install it like an app, use your browser's "Install app" or "Add to Home Screen".

## Your data

Everything is stored in your browser's local storage on that device. Nothing is sent anywhere. Clearing site data erases it, so use **Settings → Download backup** now and then. There's no sync between devices; move data with backup and restore.

## Limits worth knowing

- **Shop Block** can't lock other apps or websites, because no web app can. It's a timed commitment: Hourwise flags every purchase you try to log while it runs, and finishing earns points. Pair it with Screen Time (iPhone), Digital Wellbeing (Android) or a site-blocker extension for a hard lock.
- **Reminders** (cooldown over, bill due) fire while Hourwise is open or running as an installed app. A web app without a server can't push notifications when fully closed.
- **Shake** needs a phone with a motion sensor. On iPhone you'll be asked to allow motion access once.

## Development

```bash
npm test
```

Runs the tests in `tests/core.test.mjs` (money math, budget, actions, data repair).

- `index.html?dev` skips the service worker and adds `window.T` to the console: `T.seed()` fills in demo data, `T.reset()`, `T.points(500)`, `T.state()`.
- Bump `VERSION` in `sw.js` on every release or installed copies stay on the old files.
- `python scripts/make-icons.py` redraws the PNG icons (needs Pillow).

Layout: `js/calc.js` (pure math), `js/actions.js` (every data change), `js/schema.js` (defaults and data repair), `js/store.js` (saving), `js/views/*` (screens).
