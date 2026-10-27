# Southern Concrete Coatings Field Desk

Field desk for [Southern Concrete Coatings](https://www.southernconcretecoatingsllc.com/) in Tallahassee. One Owner login runs the whole job: a photo quote, the customer answer (Approve / Changes / Decline / Other), before-and-after photos, **Job complete**, then an invoice prefilled from the quote.

The screen pattern follows the all-in-one Field Desk. [austin-tss/walker](https://github.com/austin-tss/walker) is the Walker Land Management app Austin named, and it was not readable from this account (GitHub returned 404). The matching all-in-one reference that was readable is [austin-tss/fielder-aio](https://github.com/austin-tss/fielder-aio): one project list, accordions, and one job screen with Step 1 Quote, Step 2 Do the job, and Step 3 Invoice. Wording, pricing, and colors are Southern Concrete Coatings.

Site address: https://austin-tss.github.io/southern-concrete/

The files are on `main`. That address stays a 404 until GitHub Pages is turned on for the repo. The token used to publish this repo cannot create the Pages site (GitHub returns "Resource not accessible by integration"). A person with admin on the repo turns it on:

1. Open https://github.com/austin-tss/southern-concrete/settings/pages
2. Build and deployment → **Deploy from a branch**
3. Branch **main**, folder **/ (root)**, then Save

That is the same publishing setup as the other field desks. `.nojekyll` is already in the repo, so the desk is served from the root of `main`.

## What you see

- Light mode, big buttons, one job on screen once you open it.
- One role: **Owner**. The PIN is in `config.js` under `ROLES`.
- Home is every project, **+ New customer quote**, and **Crew schedule**.
- Photo quote with square footage, coating system, color or flake, prep, cure time, and price per square foot. Customer name, address, and email sit in an accordion. Notes can be typed or dictated in browsers that support speech recognition.
- Address suggestions (Photon, then Nominatim), biased toward Tallahassee.
- Customer email with A / B / C / Other, plus a PDF estimate. The job screen can resend that quote.
- On an approved job: before and after photos and a **JOB COMPLETE** button. That sends the recap, with the photos and a refer-a-neighbor link, and stays on the job for the invoice.
- Invoice prefilled from the quote, with an Open / Paid toggle.
- One Google Drive folder per project, under a root folder named `Southern Concrete Coatings Field Desk`.

## Test mode

`TEST_MODE` in `config.js` is the switch for the browser. The same flag at the top of `Code.gs` is the switch that actually sends mail. **Both default to `true`. Change them together.**

While test mode is on, every message — To and Reply-To — is forced to `austin@techsourcedsolutions.com`, no matter what customer address is typed. The yellow **Test mode** bar stays on screen. The customer address is only stored on the job. Turning the flag off is what lets mail go to that customer.

## Logins

Owner is the only role. The PIN is in `config.js` under `ROLES`. It is a field PIN for this static page, not an account password. Change it before the crew uses the desk. Do not put real passwords in the repo.

## Brand

Logo file: `logo.png`, saved from the logo on https://www.southernconcretecoatingsllc.com/ (Squarespace file `SCClogo JPG`).

Colors sampled from that logo:

- Slate wordmark `#424866` (buttons)
- Deeper slate `#3a415c` (header) and `#2a3148`
- Gray tagline `#707070`
- Ink `#212020` and page background `#f4f5f7`

Phone on the site: (850) 766-9992. Mail contact published on the site: mccardlematt@yahoo.com. The address line is Tallahassee, FL, which is all the business site publishes.

## Run the screens locally

The desk is static. Open `index.html` only after you have a backend URL, or use the local mock, which speaks the same JSON contract and still enforces test mode:

```bash
npm install
npm test
npm run e2e
node test/mock-server.mjs
```

The mock prints a URL. It stores jobs in memory and does not call Gmail or Drive.

## Deploy the site

The one-time Pages switch is in the section above. After that, pushes to `main` are what GitHub publishes.

`.github/workflows/pages.yml` is the alternate path: source **GitHub Actions**. It copies `index.html`, `config.js`, `quote.js`, `app.js`, and `logo.png` into the Pages artifact. It cannot create the Pages site by itself. Once a person has turned Pages on and set the source to GitHub Actions, re-run that workflow.

## Connect Gmail and Drive

There is no API key in this repo. Apps Script uses the Google account you deploy with.

1. Open https://script.google.com and create a project.
2. Replace the default script with the full contents of `Code.gs`.
3. In the editor, run `setup` once. Approve Drive and Gmail when Google asks.
4. Deploy → New deployment → Web app. Execute as **Me**. Access **Anyone**.
5. Copy the URL that ends in `/exec`.
6. On the field desk, paste that URL into **Connect backend**, or set `API_URL` in `config.js` and push. Leave `TEST_MODE` true.
7. Do not paste the Fielder web app URL here. That script writes into a different Drive folder.

`Code.gs` creates the Drive root on first use and one folder per project (`SCC-… - customer - address`). Quote photos, crew photos, and the PDF estimate go in that folder.

When you are ready for real customers, set `TEST_MODE` to `false` in **both** `config.js` and `Code.gs`, and redeploy the web app (New deployment, not just a save). Until that deploy, the server keeps sending only to the test address.

## What is not in this repo

- No Google password, OAuth client secret, or Apps Script token.
- No PowerShell.
- Voice dictation needs the browser Speech Recognition API (Chrome on a phone is the one that works in the field). Other browsers get a note to type instead.
- The customer answer page (the buttons in the email) is hosted by Apps Script, not by GitHub Pages.
