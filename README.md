# Fire & Safety ERP: clickable prototype

A prototype of the whole product, made only to **look at it and try it**: every
screen is clickable, the data is invented, and nothing is sent anywhere. It has
no server. Changes you make are saved in your browser only.

It is not the product. The product is built later, in the main repository,
after the owner has judged the flows here.

## Run it

```bash
pnpm install     # once
pnpm dev         # opens http://localhost:3000
```

Use **View as** (top bar) to see the product as another person of the demo
company. Use **Phone view** (top bar) to open a phone next to the office: it
shows a technician's phone and shares the data with the office window, so you
can plan a job as the coordinator and watch it arrive on the phone. Use **Reset demo data** (account menu) to start again from the first
sample.

## What is in it

The demo company is an invented Dubai fire and safety contractor. All names,
phone numbers, TRNs and amounts are samples.

| Step | Area                            | State       |
| ---- | ------------------------------- | ----------- |
| 1    | Shell, Customers (with Sites, Contacts, Equipment), Home, Settings | built |
| 2    | Sales: enquiries, quotations of four kinds with approval (the catalogue moved to Inventory in step 6) | built |
| 3    | Service: contracts, jobs (visits, call-outs, repairs), deficiencies, equipment register, compliance | built |
| 4    | Technician phone view: Today, job page for the phone, photos, timer, phone frame next to the office | built |
| 5    | Projects (packages, site work, costs, variations, claims, documents, testing and handover) and the Schedule planning board | built |
| 6    | Purchases (suppliers, purchase orders with approval, deliveries, supplier bills) and Inventory (items, stock in the store and the vans, movements, reorder suggestions) | built |
| 7    | Billing (invoices from contracts, claims, jobs and supplies; receipts with allocation; credit notes with approval; statements with ageing) | built |
| 8    | Home by role, Reports, Journeys, polish | to come     |

The ten areas and their order are the proposal of decision record 39 of the
main repository (status: Proposed). The prototype helps to test it.

## How it is made

Plain JavaScript (no TypeScript), React 19, Vite, Tailwind CSS 4,
`react-router`, `lucide-react` icons, Inter font. Nothing else.

```
src/
  data/       areas, roles, equipment catalogue, numbering, the words and rules of Sales, Service, Projects, Purchases and Billing, and seed/ (the sample data)
  store/      one saved object of tables, actions that change it, selectors that read it (links.js keeps the threads between areas)
  ui/         the shared pieces: Button, Badge, Floating/Menu, Form, Combobox, Table, Page...
  shell/      the frame: top bar, search, sidebar, phone bar, View as, bell, account
  pages/      one folder per area
```

Rules the code follows:

- Data changes only through the action files of `store/` (`actions.js`, `salesActions.js`,
  `serviceActions.js`, `projectActions.js`, `scheduleActions.js`, `purchaseActions.js`,
  `inventoryActions.js`, `billingActions.js`); every action is one transaction and writes
  a line into the activity list.
- A stock balance is never stored: it is the sum of the rows of the `movements`
  table (deliveries, parts used on jobs, transfers, counts, issues to projects).
  The materials cost of a project is never typed: it comes from its purchase
  orders and from the stock issued to it (`projectView` in `purchaseSelectors.js`).
- An invoice is never typed from nothing: it is made from the record it comes from
  (an instalment of a contract, a claim of a project, a job, an accepted supply), and
  the two sides are changed in one transaction, so they never disagree. An invoice that
  is issued is never changed: a credit note corrects it. Money is not a button on an
  invoice: a receipt says which invoices it pays, and what no invoice takes stays on
  account. What a customer owes, its ageing and its statement are worked out from these
  documents (`billingSelectors.js`); no total is stored.
- Sample dates are relative to today, so "due in 12 days" stays true whenever
  the prototype is opened.
- A screen says "sample" wherever a fact was assumed (the "i" button on every
  screen lists what is assumed).
