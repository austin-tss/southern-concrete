# Southern Concrete Coatings

Job desk for [Southern Concrete Coatings](https://www.southernconcretecoatingsllc.com/) in Tallahassee. One Owner login runs the whole job: a photo quote, the customer answer (Approve / Changes / Decline / Other), before-and-after photos, **Job complete**, then an invoice prefilled from the quote.

The home screen matches the Walker Land Management layout: a header with the logo and company name, **+ New quote**, **Customers**, **Bookkeeping**, search, Estimates / Jobs / Done, **Refresh**, and **Settings**. Wording, pricing, and colors are Southern Concrete Coatings.

Site address: https://austin-tss.github.io/southern-concrete/

GitHub Pages publishes the files on `main`.

## What you see

- Light mode, big buttons, one job on screen once you open it.
- One role: **Owner**. The PIN is in `config.js` under `ROLES`.
- Home is **+ New quote**, **Customers**, **Bookkeeping**, a search box (`Search name, address or estimate #`), and Estimates / Jobs / Done with counts.
- **Customers** groups jobs by email, with call, text, email, totals, and a new quote for that customer.
- **Bookkeeping** covers collected totals, unpaid invoices, expenses, receipt photos, profit, and QuickBooks CSV export. Receipt photos are stored in Drive. Automatic receipt reading is off, so the amounts are typed in.
- **Settings** stores a payment link, a Google review link, and a financing link. Those links become **Pay now** and **Pay over time** on quote and invoice emails, and **Request review** on a finished or paid job.
- Photo quote with square footage, coating system, color or flake, prep, cure time, and price per square foot. Customer name, address, email, and phone sit in an accordion. Notes can be typed or dictated in browsers that support speech recognition.
- Address suggestions (Photon, then Nominatim), biased toward Tallahassee.
- Customer email with A / B / C / Other, plus a PDF estimate. The job screen can resend that quote.
- On an approved job: before and after photos and a **JOB COMPLETE** button. That sends the recap, with the photos and a refer-a-neighbor link, and stays on the job for the invoice.
- Invoice prefilled from the quote, with a recorded payment (check, cash, card, or other) and an undo that marks it open again.
- One Google Drive folder per project, under a root folder named `Southern Concrete Coatings`. Receipt photos go in a `Receipts` folder under that root.

## Mail

`TEST_MODE` in `config.js` is the switch for the browser. The same flag at the top of `Code.gs` is the switch that actually sends mail. **Both are `false`.** That means quote, invoice, recap, and review mail go to the customer address on the job, with reply-to `mccardlematt@yahoo.com`.

Set both copies back to `true` only if you want every message forced to `austin@techsourcedsolutions.com`, then redeploy the web app.

Sign-in still posts `{a:'signin', role, ua}`. `Code.gs` keeps that action and `GET a=logins`.

## Logins

Owner is the only role. The PIN is in `config.js` under `ROLES`. It is a field PIN for this static page, not an account password. Do not put real account passwords in the repo.

## Brand

Logo file: `logo.png`, saved from the logo on https://www.southernconcretecoatingsllc.com/.

Colors sampled from that logo:

- Slate wordmark `#424866` (buttons, including + New quote)
- Deeper slate `#3a415c` (header, Customers, Bookkeeping, active tab) and `#2a3148`
- Gray tagline `#707070`
- Ink `#212020` and page background `#f4f5f7`

Phone on the site: (850) 766-9992. Mail contact published on the site: mccardlematt@yahoo.com. The address line is Tallahassee, FL, which is all the business site publishes.

## Run the screens locally

The app is static. Open `index.html` only after you have a backend URL, or use the local mock, which speaks the same JSON contract:

```bash
npm install
npm test
node test/mock-server.mjs
```

The mock prints a URL. It stores jobs in memory and does not call Gmail or Drive. Do not point a test at the live `/exec` URL while `TEST_MODE` is false.

## Deploy the site

Pushes to `main` are what GitHub Pages publishes at https://austin-tss.github.io/southern-concrete/.

`.github/workflows/pages.yml` is the GitHub Actions path. It copies `index.html`, `config.js`, `quote.js`, `app.js`, and `logo.png` into the Pages artifact.

## Connect Gmail and Drive

There is no API key in this repo. Apps Script uses the Google account you deploy with. `API_URL` in `config.js` already points at the deployed `/exec` URL. Keep that URL unless you create a new deployment.

1. Open the existing Apps Script project (the one behind that `/exec` URL).
2. Replace the script with the full contents of `Code.gs`.
3. Deploy → **New deployment** → Web app. Execute as **Me**. Access **Anyone**. A save alone does not update the live `/exec` URL.
4. If Google gives you a new URL, put it in `API_URL` and push. If the URL stays the same, leave `API_URL` alone.
5. Leave `TEST_MODE` false in both files.

`Code.gs` creates the Drive root on first use and one folder per project (`SCC-… - customer - address`). Quote photos, crew photos, and the PDF estimate go in that folder.

Customers, Bookkeeping, and Settings show on the home screen as soon as Pages updates. Saving settings, expenses, receipt photos, phone numbers, recorded payments, and review requests needs the new `Code.gs` deployed. Until that deploy, those saves return "Bad action" from the current script.

## What is not in this repo

- No Google password, OAuth client secret, or Apps Script token.
- No PowerShell.
- Voice dictation needs the browser Speech Recognition API (Chrome on a phone is the one that works in the field). Other browsers get a note to type instead.
- The customer answer page (the buttons in the email) is hosted by Apps Script, not by GitHub Pages.
- No automatic receipt OCR. The photo is saved and the amounts are entered by hand.
