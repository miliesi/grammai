# Feedback endpoint

The extension captures bugs and ideas in `feedback.html` and sends them only after the user presses Send feedback. A Cloudflare Worker creates public issues in `zilvestro/grammai`. Users need no GitHub account and stay in the extension. GitHub stores the report; the worker has no separate report database.

## Deploy

1. Sign in to the Cloudflare account that should own `grammai-feedback`:

   ```sh
   npx wrangler@4.151.3 login --scopes account:read user:read workers:write workers_scripts:write
   ```

2. Create a dedicated, fine-grained GitHub personal access token for **only `zilvestro/grammai`**, with **Issues: Read and write**. Do not reuse a broad developer CLI token. Paste the dedicated token into Wrangler's secret prompt, not a source file or chat:

   ```sh
   npx wrangler@4.151.3 secret put GITHUB_TOKEN --config services/feedback/wrangler.jsonc
   ```

3. Deploy the worker:

   ```sh
   npx wrangler@4.151.3 deploy --config services/feedback/wrangler.jsonc
   ```

4. Set `endpoint` in `feedback.config.json` to the deployed HTTPS URL plus `/v1/feedback`, then commit that public URL and rebuild:

   ```json
   {
     "endpoint": "https://grammai-feedback.grammai.workers.dev/v1/feedback"
   }
   ```

   ```sh
   npm run build
   ```

The committed endpoint is `https://grammai-feedback.grammai.workers.dev/v1/feedback`. The service must have its `GITHUB_TOKEN` secret before reports can be saved. Both GitHub source builds and Store packages use this endpoint without user configuration. A build can override it with `GRAMMAI_FEEDBACK_ENDPOINT` for testing or a fork. Clearing the endpoint disables direct sending and shows email fallback. Do not release a build pointed at an unconfigured service as live.

The build adds only the chosen HTTPS origin to host permissions and the extension's `connect-src` policy. Do not add tokens to `feedback.config.json`, build variables or the extension. `.dev.vars` files and Wrangler's local state are ignored by Git.

## Optional screenshots

Screenshots are implemented but remain unavailable on the live service until R2 is activated and bound. Text reports work without R2. To enable uploads:

1. Activate R2 in the owning Cloudflare account if necessary. Cloudflare requires its R2 checkout flow; included free usage and usage-based billing apply. See [R2 setup](https://developers.cloudflare.com/r2/get-started/).
2. Create the private bucket (do not enable public bucket access):

   ```sh
   npx wrangler@4.151.3 r2 bucket create grammai-feedback-images
   ```

3. Uncomment `r2_buckets` in `services/feedback/wrangler.jsonc` and deploy using the same command above. The existing GitHub token needs no additional permissions. No extension rebuild is needed to enable uploads.

Opening **Add screenshots** checks `GET /v1/feedback`, which returns `{ "images": true }` only when the bucket binding exists. The form accepts up to two PNG, JPEG or WebP files of 2 MiB each. It redraws each selected image locally as PNG, strips original filenames and embedded metadata, rejects images above 16 million pixels or normalized images above 2 MiB, and offers previews and removal. Selection sends no images. Pressing Send submits the explicit report fields and normalized images together as multipart form data. Text-only reports continue to use JSON.

The Worker checks count, size and PNG headers before storing under random UUID filenames, and embeds image URLs in the issue. `GET`/`HEAD /images/<uuid>.png` serve only these PNG objects with a fixed image type and `nosniff`, so GitHub's image proxy can display them. No public bucket listing or standalone upload endpoint is exposed. Storage calls use the Worker binding, with no extra client secret.

Images stay in R2 until a maintainer removes them. Deleting an issue does not automatically delete its objects. For a removal request, identify the UUID from the issue's Markdown and run `npx wrangler@4.151.3 r2 object delete grammai-feedback-images/<uuid>.png --remote`. Remove the issue image link as well; GitHub may retain its own proxy cache. Uploads are cleaned up after a failed storage write or a definitive GitHub 4xx rejection. After an ambiguous timeout or 5xx, they are retained because an issue might already reference them; maintainers should reconcile these occasional orphans. Rate limits bound submissions per Cloudflare location, not total account storage or billing. Monitor R2 usage and moderate public reports.

## Behavior

`POST /v1/feedback` accepts JSON with `kind` (`bug` or `idea`), `title` (3–120 characters), `description` (10–6,000 characters) and a dotted numeric extension `version`. It creates a labeled issue and returns HTTP 201 with `{ "number": 42, "url": "https://github.com/zilvestro/grammai/issues/42" }` only after GitHub confirms creation. It cannot select arbitrary repositories or attach editor data, URLs, tokens or network metadata to issues.

Cross-origin requests are permitted for syntactically valid Chrome extension origins so unpacked builds and Store IDs both work. This is compatibility filtering, not authentication: the endpoint intentionally accepts anonymous feedback. Rate-limit bindings allow three requests per minute per network and thirty total per minute in each Cloudflare location. These are per-location limits, not strict global quotas; adjust the unique namespaces and limits for the account if necessary. No cookies or client secrets are used. Request bodies are bounded, errors do not expose upstream responses, and worker observability is disabled in the supplied configuration.

The form prevents repeated clicks while sending and retains the user's text on failure. An ambiguous timeout tells the user to check existing issues before resubmitting; there is no automatic retry or exactly-once delivery guarantee. Renew an expired GitHub token using `wrangler secret put` without rebuilding the extension. Unavailable services fall back to email.

## Verify

```sh
npm run typecheck
npm test
npx wrangler@4.151.3 deploy --config services/feedback/wrangler.jsonc --dry-run
GRAMMAI_FEEDBACK_ENDPOINT=https://feedback.grammai.test/v1/feedback npm run build
npm run test:feedback
```

Tests mock GitHub and the submission endpoint; no public issues are posted. Test the extracted Store ZIP using `GRAMMAI_EXTENSION_PATH=/path/to/extracted/package npm run test:feedback`. Rebuild with the committed production endpoint before packaging a release. Live smoke tests should use an explicitly agreed synthetic report because successful submissions are public.

References: [Cloudflare secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/), [GitHub issue creation](https://docs.github.com/en/rest/issues/issues#create-an-issue).
