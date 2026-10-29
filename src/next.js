// The redesign's private test copy at …/next/, built from the redesign branch
// with VITE_NEXT=1 (see .github/workflows/deploy.yml). Same accounts and data
// as the team's app, but only Asher gets in; everyone else is sent back to
// the team's app. It never turns on notifications, so his don't come twice.
export const NEXT = import.meta.env.VITE_NEXT === '1';
