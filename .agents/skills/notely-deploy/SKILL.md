# Notely deployment checklist

Use this guide whenever building, publishing, or deploying this repository. A GitHub commit is not proof that Vercel deployed successfully.

## Why the deployment failed before

On 2026-10-28, two commits containing the mobile Notes chat change failed on Vercel. The source was sent as a whole file through a contents API; a typographic apostrophe in an existing JavaScript string was converted to an ASCII apostrophe. This made the JSX invalid (Expected "}" but found "ve"). The fix was to use a double-quoted JavaScript string at that expression, then verify the new deployment reached Ready.

## Before pushing

1. Check the exact diff and confirm only intended files changed. Never include .env, API keys, credentials, or local configuration.
2. Prefer a normal Git commit and push from the repository when available. Avoid replacing whole source files through a web/API tool: encoding or punctuation conversion can silently alter code.
3. If a contents API must be used, fetch the target file first, apply a minimal edit, and fetch it back after writing. Compare the saved source around every edited expression, especially quotes, apostrophes, backslashes, and JSX braces.
4. Run npm run build locally before publishing whenever dependencies are available. If the build cannot run, say so and rely on Vercel's build result before calling the deploy successful.

## After pushing

1. Confirm the pushed commit is the latest commit on main.
2. Open that exact commit's Vercel deployment and inspect Build Logs if it fails. Do not infer success from GitHub's push result.
3. Wait for the deployment status to become Ready. If it fails, fix the reported source/build issue, commit the fix, and inspect the next deployment.
4. Open the production URL after Ready and verify the changed flow. For responsive changes, check a phone-sized viewport and desktop; check the visible control and its open/close or navigation behavior.
5. Report the commit, deployment status, and what was actually verified. Clearly distinguish local checks from live checks.

## Source-transfer guardrails

- Keep edits small and scoped to the requested component or breakpoint.
- Preserve typographic punctuation in source; do not globally normalize quotes.
- In JavaScript expressions, use valid escaped or double-quoted string literals when apostrophes occur in the text.
- Never claim a feature works in production while its deployment is Building or Error.

