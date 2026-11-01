# raff

## ميزانيتي · My Budget (`budget/`)

A phone-first personal finance app in **Arabic and English**, based on the *Personal Budget* spreadsheet
(monthly cashflow + ratios sheet).

- Enter the amount you have (income, a bonus, or your balance) and it splits it using a plan:
  **50/30/20, 70/20/10, 60/20/20, 80/20, 40/30/20/10 (with giving)** or a **custom** split,
  with suggested amounts per category. Apply it as the month's budget with one tap.
- Track income and expenses per month (same categories as the spreadsheet), quick-add with the + button.
- Opening balance carries over from last month's closing balance, like the spreadsheet.
- Year overview, ratios as % of income, savings goal and emergency-fund calculator.
- CSV export, JSON backup/restore. Light/dark mode. All data stays on the device (localStorage).
- Installable (PWA) and works offline: open it on your phone, then **Add to Home Screen**.

Run locally: `cd budget && python3 -m http.server` and open http://localhost:8000.

## مُنمذِج · Modeler (`modeling/`)

Financial models built from your own numbers, in **Arabic and English**:

- **DCF**: base-year revenue, per-year assumptions (growth, EBITDA margin, D&A, capex, working capital, tax),
  WACC built up with CAPM (or entered manually), perpetual-growth or exit-multiple terminal value, mid-year
  convention, equity bridge to value per share, and a WACC × growth / multiple sensitivity table.
- **3-Statement**: base-year income statement and balance sheet (revenue, COGS, inventory, receivables,
  payables, debt…) plus forecast drivers (DSO/DIO/DPO, capex, payout, debt repayment) produce a linked income
  statement, balance sheet and cash flow that balance every year.
- Preview the model in the page, then **download it as Excel** with live formulas (inputs in blue).
- Every build picks a **different design** (10 themes: colours, fonts, header and KPI layouts) for both the
  preview and the Excel file; "Another design" re-rolls it.

Run locally: `cd modeling && python3 -m http.server` and open http://localhost:8000.
ExcelJS (MIT) is bundled in `modeling/vendor/` so the page works offline.
