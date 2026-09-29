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
company. Use **Reset demo data** (account menu) to start again from the first
sample.

## What is in it

The demo company is an invented Dubai fire and safety contractor. All names,
phone numbers, TRNs and amounts are samples.

| Step | Area                            | State       |
| ---- | ------------------------------- | ----------- |
| 1    | Shell, Customers (with Sites, Contacts, Equipment), Home, Settings | built |
| 2    | Sales                           | next        |
| 3    | Service                         | to come     |
| 4    | Technician phone view           | to come     |
| 5    | Schedule and Projects           | to come     |
| 6    | Purchases and Inventory         | to come     |
| 7    | Billing                         | to come     |
| 8    | Home by role, Reports, Journeys | to come     |

The ten areas and their order are the proposal of decision record 39 of the
main repository (status: Proposed). The prototype helps to test it.

## How it is made

Plain JavaScript (no TypeScript), React 19, Vite, Tailwind CSS 4,
`react-router`, `lucide-react` icons, Inter font. Nothing else.

```
src/
  data/       areas, roles, equipment catalogue, numbering, and seed/ (the sample data)
  store/      one saved object of tables, actions that change it, selectors that read it
  ui/         the shared pieces: Button, Badge, Floating/Menu, Form, Combobox, Table, Page...
  shell/      the frame: top bar, search, sidebar, phone bar, View as, bell, account
  pages/      one folder per area
```

Rules the code follows:

- Data changes only through `store/actions.js`; every action is one transaction
  and writes a line into the activity list.
- Sample dates are relative to today, so "due in 12 days" stays true whenever
  the prototype is opened.
- A screen says "sample" wherever a fact was assumed (the "i" button on every
  screen lists what is assumed).
