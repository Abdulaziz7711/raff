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
