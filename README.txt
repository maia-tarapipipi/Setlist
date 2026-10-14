SETLIST — UPDATED WORKOUT TRACKER

FILES
- index.html: page structure and screen content
- styles.css: colours, spacing, layout, and responsive styling
- app.js: application entry point, UI rendering, actions, and event handlers
- js/config.js: storage key, defaults, and exercise catalogue
- js/utils.js: shared DOM, date, cloning, and HTML-escaping helpers
- js/workout.js: reusable workout and set factories
- js/timer.js: reusable rest-timer controller
- js/render.js: reusable workout, library, and history renderers
- manifest.json: installable-app metadata
- sw.js: offline cache and update version
- icons/: app icons

FEATURES IN THIS VERSION
- Automatically follows your device’s light or dark colour preference.
- Choose a past, current, or future date with the date picker.
- Log workouts against past dates; future dates use “Save plan” and appear under Upcoming plans in History.
- History sets appear on separate plain-text lines, without completion ticks or bullet points.
- Edit a history entry’s date, notes, exercise names, set weights/reps, and completed status; delete duplicate entries.
- Tap an exercise in the catalogue to edit or delete it; use the trailing Add button to add it to the current workout.
- Tap a completed workout in History to view it, then use the three-dot menu to edit it on a dedicated page or delete it.
- Edit the favourite workout on its own screen, including its name, description, selected exercises, drag ordering, and removal actions.
- Timer controls show + and − rather than +15 and −15, and the timer has no heading.
- HTML, CSS, and JavaScript are separate files for easier manual editing.

IMPORTANT DATA NOTE
The app keeps using the existing localStorage key `setlist-workout-v1` so data already saved in the browser can continue to be read. Export a backup from Setlist before replacing files. Do not clear browser/site storage while updating.

UPDATE GITHUB PAGES
1. Download and unzip this package.
2. Upload the CONTENTS of the unzipped folder into the root of your Setlist GitHub repository, replacing index.html, manifest.json, sw.js, and icons as prompted. Also add styles.css, app.js, and README.txt.
3. Commit the changes and wait for GitHub Pages to publish.
4. Close and reopen Setlist on your phone, then refresh the page. The service worker cache version was updated to trigger a fresh app shell.

MANUAL EDITING
- Change wording and HTML structure in index.html.
- Change visual styling in styles.css.
- Change data, behaviour, and event handlers in app.js.
- Keep the KEY constant in app.js unchanged unless you intentionally want to start with a separate empty local data store.
