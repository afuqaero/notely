# Project Editing Rules

## Make only the requested change

- First inspect the component and styles related to the reported issue.
- Change only the smallest relevant section needed to fix that issue.
- Leave unrelated components, wording, behavior, styling, and files untouched.
- Do not refactor, redesign, replace, or remove existing content unless the user explicitly asks for it.
- Keep frontend work in the frontend. Do not change APIs, server logic, data handling, storage, or deployment settings unless the user asks or the requested fix requires it; explain when it does.

## Preserve responsive layouts

- Treat mobile and desktop layouts as separate unless the user asks for a shared change.
- For a mobile-only issue, make the change inside the relevant mobile breakpoint and preserve desktop styles and layout.
- For a desktop-only issue, preserve mobile breakpoint rules.
- Avoid broad selectors, shared tokens, or base styles when a scoped rule can fix the issue.
- When changing responsive styles, review the affected viewport and the other viewport to confirm the change did not cause collateral layout changes, when a browser preview is available.

## Preserve existing visuals and assets

- Keep existing images, illustrations, icons, logos, animations, crops, sizing, placement, and visual effects unchanged unless the user specifically requests a change to them.
- Do not substitute, remove, regenerate, or relocate an existing asset as part of an unrelated layout fix.
- Preserve the existing design and behavior around the requested element; do not treat a local fix as permission for a broader visual refresh.

## Review before finishing

- Review the diff and confirm every changed file and rule is necessary for the requested issue.
- Call out any necessary change outside the affected section before making it; do not silently broaden the scope.
## Deployment

- Before pushing or deploying this repository, read .agents/skills/notely-deploy/SKILL.md. Verify the exact pushed source, Vercel Ready status, and live behavior before reporting completion.

