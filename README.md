# Orvan

Both editions use the same source code, so every fix reaches the demo and the
tester edition together.

| Edition | Build | Output | First visit |
| --- | --- | --- | --- |
| Local demo | `npm run build` | `out` | Sample tasks, projects and finances |
| Tester folder | `npm run build:blank` | `out 2` | Empty account |
| Netlify site | Automatic build using `netlify.toml` | `out` | Empty account |

The tester-folder command also restores the local demo in `out`. Generated
folders are not committed; GitHub stores the source and build configuration.

## Netlify

The repository's `netlify.toml` selects `NEXT_PUBLIC_ORVAN_BLANK=1` at build time
and publishes the static export in `out`. It takes precedence over matching
build settings in the Netlify dashboard. Pushes to the connected production
branch rebuild the empty tester edition automatically. The Next.js server
adapter is skipped because this app is entirely static.

For a local demo, leave `NEXT_PUBLIC_ORVAN_BLANK` unset or set it to `0`.

## Browser data

Tasks, projects and monthly finances are stored in each user's browser. New
visitors to the tester edition start empty. Returning testers keep their saved
data when the site is updated at the same address.

Demo and tester data use separate storage keys, including when switching the
same site from the demo edition to the tester edition. This does not delete
the previously saved demo data.

## Local development

Install dependencies with `npm ci`, then run `npm run dev`. To serve the built
folders, use `npm run serve` for the demo or `npm run serve:blank` for testers.
Open the server address instead of opening `index.html` directly.
