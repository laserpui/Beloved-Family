# Google Apps Script migration

The deployed Apps Script projects are not stored in this workspace and were not discoverable through the connected Drive account. Frontend hardening therefore keeps compatibility fallbacks where required.

## Kids Savings

The frontend now sends a POST request first with a JSON body and `Content-Type: text/plain;charset=utf-8`. The existing GET write is used only when POST is unavailable.

Update the deployed script so `doPost(e)`:

1. parses `JSON.parse(e.postData.contents)`;
2. validates `action === "add"`, `sheetName`, `type`, date and a positive finite amount;
3. stores description as plain text, not as a Sheet formula;
4. returns `{"success":true}` as JSON;
5. rejects unknown sheet names and transaction types.

After the deployment is verified, set `KS_ALLOW_LEGACY_GET_FALLBACK` to `false` in `kids-savings.js`.

## Mona Gym

The current deployment requires `no-cors`, so the browser cannot inspect the POST response. The frontend now reads the dataset before and after submission and only shows confirmed success when the matching-row count increases.

The preferred backend upgrade is a POST endpoint that returns readable JSON. After that deployment:

1. remove `mode: "no-cors"`;
2. parse and validate the JSON response;
3. retain the read-back check as defense against partial writes;
4. validate receipt MIME type and byte size server-side.

## Authentication

`Admin1234` in the frontend is only a convenience gate. Real security must be enforced through Google sharing permissions, Google identity, or a server-issued short-lived token. Do not rely on a password embedded in JavaScript to protect financial data.
