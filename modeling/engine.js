/* Modeling engine: builds DCF / 3-statement models from inputs, evaluates them,
   and writes them to Excel with live formulas. Shared by the page and the tests.

   Every model cell is either an input number or a formula written in a small DSL:
     {id}        same column of row `id` (or column 0 when that row is a scalar)
     {id@-1}     relative column offset
     {id#3}      absolute column index (0 = base year)
     {id#1:5}    a range (for SUM)
     {#}         index of the current column
   The same text is turned into JavaScript (for the preview) and into an Excel
   formula (for the download), so both always agree. */
(function (root) {
  'use strict';

  /* ---------------- labels ---------------- */
  const L = {
    // sheets
    sh_inputs: ['المدخلات', 'Inputs'], sh_is: ['قائمة الدخل', 'Income Statement'],
    sh_bs: ['الميزانية العمومية', 'Balance Sheet'], sh_cf: ['التدفقات النقدية', 'Cash Flow'],
    sh_dcf: ['التدفقات المخصومة', 'DCF'], sh_val: ['التقييم', 'Valuation'],
    m_tsm: ['نموذج القوائم المالية الثلاث', '3-Statement Model'],
    m_dcf: ['نموذج التدفقات النقدية المخصومة', 'Discounted Cash Flow Model'],
    legend: ['الأزرق = مدخلات · الأسود = معادلات', 'Blue = inputs · Black = formulas'],
    // blocks
    b_hist_is: ['قائمة الدخل التاريخية (سنة الأساس)', 'Historical income statement (base year)'],
    b_hist_bs: ['الميزانية التاريخية (سنة الأساس)', 'Historical balance sheet (base year)'],
    b_assump: ['افتراضات التوقع', 'Forecast assumptions'],
    b_rev: ['الإيرادات والربحية', 'Revenue & profitability'],
    b_below: ['أسفل الربح التشغيلي', 'Below EBIT'],
    b_assets: ['الأصول', 'Assets'], b_liab: ['الالتزامات', 'Liabilities'], b_eq: ['حقوق الملكية', 'Equity'],
    b_cfo: ['التدفقات من الأنشطة التشغيلية', 'Cash flow from operations'],
    b_cfi: ['التدفقات من الأنشطة الاستثمارية', 'Cash flow from investing'],
    b_cff: ['التدفقات من الأنشطة التمويلية', 'Cash flow from financing'],
    b_cash: ['حركة النقد', 'Cash movement'],
    b_base: ['سنة الأساس', 'Base year'], b_wacc: ['تكلفة رأس المال (WACC)', 'Cost of capital (WACC)'],
    b_term: ['القيمة النهائية', 'Terminal value'], b_bridge: ['من قيمة المنشأة إلى حقوق الملكية', 'Equity bridge'],
    b_fcf: ['التدفق النقدي الحر', 'Free cash flow'], b_disc: ['الخصم', 'Discounting'],
    b_ev: ['قيمة المنشأة', 'Enterprise value'], b_eqv: ['قيمة حقوق الملكية', 'Equity value'],
    b_checks: ['اختبارات منطقية', 'Cross-checks'],
    b_sens_g: ['حساسية قيمة السهم: WACC × معدل النمو', 'Sensitivity — value per share: WACC × growth'],
    b_sens_m: ['حساسية قيمة السهم: WACC × المضاعف', 'Sensitivity — value per share: WACC × exit multiple'],
    b_sens_g_eq: ['حساسية قيمة الملكية: WACC × معدل النمو', 'Sensitivity — equity value: WACC × growth'],
    b_sens_m_eq: ['حساسية قيمة الملكية: WACC × المضاعف', 'Sensitivity — equity value: WACC × exit multiple'],
    sens_corner_g: ['WACC ↓ · النمو →', 'WACC ↓ · growth →'],
    sens_corner_m: ['WACC ↓ · المضاعف →', 'WACC ↓ · multiple →'],
    value: ['القيمة', 'Value'],
    // income statement
    rev: ['الإيرادات', 'Revenue'], cogs: ['تكلفة المبيعات', 'Cost of goods sold'],
    gp: ['مجمل الربح', 'Gross profit'], gm: ['هامش مجمل الربح %', 'Gross margin %'],
    sga: ['المصاريف البيعية والإدارية', 'SG&A expenses'], ebitda: ['EBITDA', 'EBITDA'],
    ebitdam: ['هامش EBITDA %', 'EBITDA margin %'], da: ['الإهلاك والاستهلاك', 'Depreciation & amortization'],
    ebit: ['الربح التشغيلي (EBIT)', 'EBIT'], int: ['مصروف الفوائد', 'Interest expense'],
    ebt: ['الربح قبل الضريبة', 'Profit before tax'], tax: ['الضريبة / الزكاة', 'Tax / Zakat'],
    ni: ['صافي الربح', 'Net income'], nm: ['هامش صافي الربح %', 'Net margin %'],
    revg: ['نمو الإيرادات %', 'Revenue growth %'],
    // balance sheet
    cash: ['النقد وما في حكمه', 'Cash & equivalents'], ar: ['الذمم المدينة', 'Accounts receivable'],
    inv: ['المخزون', 'Inventory'], oca: ['أصول متداولة أخرى', 'Other current assets'],
    tca: ['إجمالي الأصول المتداولة', 'Total current assets'], ppe: ['الممتلكات والمعدات (صافي)', 'PP&E, net'],
    onca: ['أصول غير متداولة أخرى', 'Other non-current assets'], ta: ['إجمالي الأصول', 'Total assets'],
    ap: ['الذمم الدائنة', 'Accounts payable'], acc: ['مستحقات ومطلوبات متداولة أخرى', 'Accrued & other current liabilities'],
    tcl: ['إجمالي الالتزامات المتداولة', 'Total current liabilities'], debt: ['القروض', 'Debt'],
    oltl: ['التزامات طويلة الأجل أخرى', 'Other long-term liabilities'], tl: ['إجمالي الالتزامات', 'Total liabilities'],
    cs: ['رأس المال', 'Share capital'], re: ['الأرباح المبقاة', 'Retained earnings'],
    te: ['إجمالي حقوق الملكية', 'Total equity'], tle: ['إجمالي الالتزامات وحقوق الملكية', 'Total liabilities & equity'],
    chk: ['فحص التوازن (يجب أن يكون صفر)', 'Balance check (should be 0)'],
    // cash flow
    cf_ni: ['صافي الربح', 'Net income'], cf_da: ['يضاف: الإهلاك والاستهلاك', 'Add: D&A'],
    cf_ar: ['التغير في الذمم المدينة', 'Change in receivables'], cf_inv: ['التغير في المخزون', 'Change in inventory'],
    cf_oca: ['التغير في الأصول المتداولة الأخرى', 'Change in other current assets'],
    cf_ap: ['التغير في الذمم الدائنة', 'Change in payables'], cf_acc: ['التغير في المستحقات', 'Change in accruals'],
    cfo: ['صافي النقد من التشغيل', 'Net cash from operations'],
    cf_capex: ['المصروفات الرأسمالية', 'Capital expenditure'], cfi: ['صافي النقد من الاستثمار', 'Net cash from investing'],
    cf_debt: ['سداد القروض', 'Debt repayment'], cf_div: ['توزيعات الأرباح', 'Dividends'],
    cff: ['صافي النقد من التمويل', 'Net cash from financing'],
    cf_net: ['صافي التغير في النقد', 'Net change in cash'], cf_beg: ['النقد أول الفترة', 'Beginning cash'],
    cf_end: ['النقد آخر الفترة', 'Ending cash'],
    // assumptions
    a_g: ['نمو الإيرادات %', 'Revenue growth %'], a_gm: ['هامش مجمل الربح %', 'Gross margin %'],
    a_sga: ['المصاريف البيعية والإدارية % من الإيرادات', 'SG&A % of revenue'],
    a_da: ['الإهلاك % من الإيرادات', 'D&A % of revenue'], a_capex: ['المصروفات الرأسمالية % من الإيرادات', 'Capex % of revenue'],
    a_dso: ['أيام التحصيل (DSO)', 'Days sales outstanding (DSO)'], a_dio: ['أيام المخزون (DIO)', 'Days inventory (DIO)'],
    a_dpo: ['أيام السداد (DPO)', 'Days payables (DPO)'], a_tax: ['معدل الضريبة / الزكاة %', 'Tax / Zakat rate %'],
    a_int: ['معدل الفائدة على القروض %', 'Interest rate on debt %'], a_rep: ['سداد القروض السنوي', 'Annual debt repayment'],
    a_pay: ['نسبة توزيع الأرباح %', 'Dividend payout %'],
    b_g: ['نمو الإيرادات %', 'Revenue growth %'], b_m: ['هامش EBITDA %', 'EBITDA margin %'],
    b_da: ['الإهلاك % من الإيرادات', 'D&A % of revenue'], b_capex: ['المصروفات الرأسمالية % من الإيرادات', 'Capex % of revenue'],
    b_nwc: ['رأس المال العامل % من التغير في الإيرادات', 'Working capital % of revenue change'],
    b_tax: ['معدل الضريبة / الزكاة %', 'Tax / Zakat rate %'],
    // historical inputs
    h_rev: ['الإيرادات', 'Revenue'], h_cogs: ['تكلفة المبيعات', 'Cost of goods sold'],
    h_sga: ['المصاريف البيعية والإدارية', 'SG&A expenses'], h_da: ['الإهلاك والاستهلاك', 'Depreciation & amortization'],
    h_int: ['مصروف الفوائد', 'Interest expense'], h_tax: ['الضريبة / الزكاة', 'Tax / Zakat'],
    h_ni: ['صافي الربح', 'Net income'],
    h_cash: ['النقد وما في حكمه', 'Cash & equivalents'], h_ar: ['الذمم المدينة', 'Accounts receivable'],
    h_inv: ['المخزون', 'Inventory'], h_oca: ['أصول متداولة أخرى', 'Other current assets'],
    h_ppe: ['الممتلكات والمعدات (صافي)', 'PP&E, net'], h_onca: ['أصول غير متداولة أخرى', 'Other non-current assets'],
    h_ap: ['الذمم الدائنة', 'Accounts payable'], h_acc: ['مستحقات ومطلوبات متداولة أخرى', 'Accrued & other current liabilities'],
    h_debt: ['القروض', 'Debt'], h_oltl: ['التزامات طويلة الأجل أخرى', 'Other long-term liabilities'],
    h_cs: ['رأس المال', 'Share capital'], h_re: ['الأرباح المبقاة', 'Retained earnings'],
    h_ta: ['إجمالي الأصول', 'Total assets'], h_tle: ['إجمالي الالتزامات وحقوق الملكية', 'Total liabilities & equity'],
    h_chk: ['فحص التوازن (يجب أن يكون صفر)', 'Balance check (should be 0)'],
    d_rev: ['إيرادات سنة الأساس', 'Base-year revenue'],
    // WACC
    w_rf: ['العائد الخالي من المخاطر %', 'Risk-free rate %'], w_beta: ['بيتا', 'Beta'],
    w_erp: ['علاوة مخاطر السوق %', 'Equity risk premium %'], w_ke: ['تكلفة حقوق الملكية', 'Cost of equity'],
    w_kd: ['تكلفة الدين قبل الضريبة %', 'Pre-tax cost of debt %'], w_tax: ['معدل الضريبة للدرع الضريبي %', 'Tax rate for tax shield %'],
    w_kdat: ['تكلفة الدين بعد الضريبة', 'After-tax cost of debt'], w_wd: ['وزن الدين %', 'Debt weight %'],
    w_we: ['وزن حقوق الملكية', 'Equity weight'], w_calc: ['WACC المحسوب', 'Calculated WACC'],
    w_ovr: ['WACC يدوي (اتركه 0 لاستخدام المحسوب)', 'Manual WACC (0 = use calculated)'], wacc: ['WACC المستخدم', 'WACC used'],
    t_method: ['طريقة القيمة النهائية (1 = نمو دائم، 2 = مضاعف خروج)', 'Terminal method (1 = perpetuity, 2 = exit multiple)'],
    t_g: ['معدل النمو الدائم %', 'Perpetual growth rate %'], t_mult: ['مضاعف EV/EBITDA عند الخروج', 'Exit EV/EBITDA multiple'],
    t_mid: ['خصم منتصف السنة (1 = نعم، 0 = لا)', 'Mid-year convention (1 = yes, 0 = no)'],
    e_debt: ['إجمالي الدين', 'Total debt'], e_cash: ['النقد', 'Cash'], e_min: ['حقوق الأقلية', 'Minority interest'],
    e_shares: ['عدد الأسهم', 'Shares outstanding'], e_price: ['سعر السهم الحالي', 'Current share price'],
    // DCF rows
    nopat: ['صافي الربح التشغيلي بعد الضريبة (NOPAT)', 'NOPAT'], pda: ['يضاف: الإهلاك', 'Add: D&A'],
    capex: ['يطرح: المصروفات الرأسمالية', 'Less: capex'], nwc: ['يطرح: الزيادة في رأس المال العامل', 'Less: increase in working capital'],
    fcf: ['التدفق النقدي الحر للمنشأة (FCFF)', 'Unlevered free cash flow (FCFF)'],
    dtax: ['يطرح: الضريبة على EBIT', 'Less: tax on EBIT'],
    per: ['فترة الخصم (سنوات)', 'Discount period (years)'], df: ['معامل الخصم', 'Discount factor'],
    pv: ['القيمة الحالية للتدفق', 'Present value of FCF'],
    v_sum: ['مجموع القيمة الحالية للتدفقات', 'Sum of PV of FCF'], v_tv: ['القيمة النهائية', 'Terminal value'],
    v_pvtv: ['القيمة الحالية للقيمة النهائية', 'PV of terminal value'], v_ev: ['قيمة المنشأة (EV)', 'Enterprise value'],
    v_tvp: ['نسبة القيمة النهائية من EV', 'Terminal value % of EV'], v_ev2: ['قيمة المنشأة', 'Enterprise value'],
    v_debt: ['يطرح: الدين', 'Less: debt'], v_cash: ['يضاف: النقد', 'Add: cash'], v_min: ['يطرح: حقوق الأقلية', 'Less: minority interest'],
    v_eq: ['قيمة حقوق الملكية', 'Equity value'], v_sh: ['عدد الأسهم', 'Shares outstanding'],
    v_ps: ['القيمة العادلة للسهم', 'Implied value per share'], v_px: ['سعر السهم الحالي', 'Current share price'],
    v_up: ['نسبة الصعود / الهبوط', 'Upside / (downside)'], v_wacc: ['WACC', 'WACC'],
    v_im: ['مضاعف EV/EBITDA الضمني للقيمة النهائية', 'Implied terminal EV/EBITDA'],
    v_ig: ['معدل النمو الدائم الضمني', 'Implied perpetual growth']
  };

  /* ---------------- design themes ---------------- */
  const THEMES = [
    { id: 'navy', ar: 'كحلي مصرفي', en: 'Navy Banker', xfont: 'Georgia', wfont: "'Amiri','Noto Naskh Arabic',Georgia,serif",
      pri: '1F3864', acc: 'C9A227', band: 'F3F6FB', tot: 'E3E9F3', ink: '1B2433', bg: 'FFFFFF', paper: 'F7F4EC',
      inFont: '1F4FD8', inFill: 'FFF7DC', head: 'solid', kpi: 'strip', bandOn: true, grid: false, dark: false },
    { id: 'emerald', ar: 'دفتر زمرّدي', en: 'Emerald Ledger', xfont: 'Calibri', wfont: "'Tajawal','IBM Plex Sans Arabic',sans-serif",
      pri: '0B5D4B', acc: '2BB673', band: 'EEF7F3', tot: 'D6EDE3', ink: '12302A', bg: 'FFFFFF', paper: 'F1F7F4',
      inFont: '0B57D0', inFill: 'F3FBF7', head: 'underline', kpi: 'cards', bandOn: false, grid: false, dark: false },
    { id: 'midnight', ar: 'منتصف الليل', en: 'Midnight Terminal', xfont: 'Consolas', wfont: "'IBM Plex Sans Arabic','IBM Plex Mono',monospace",
      pri: '111827', acc: 'F59E0B', band: '1A2230', tot: '263042', ink: 'E5E7EB', bg: '0D1320', paper: '0A0F1A',
      inFont: '60A5FA', inFill: '13233D', head: 'solid', kpi: 'big', bandOn: true, grid: false, dark: true,
      xband: 'F3F4F6', xtot: 'E5E7EB', xink: '111827', xinFont: '1D4ED8', xinFill: 'FEF3C7' },
    { id: 'sand', ar: 'رمال الصحراء', en: 'Desert Sand', xfont: 'Tahoma', wfont: "'Readex Pro','IBM Plex Sans Arabic',sans-serif",
      pri: '8A5A2B', acc: 'D9A441', band: 'FBF5EC', tot: 'F1E3CC', ink: '3B2A1A', bg: 'FFFDF8', paper: 'F6EEDF',
      inFont: '1E4FC2', inFill: 'FFF4D6', head: 'outline', kpi: 'cards', bandOn: true, grid: true, dark: false },
    { id: 'burgundy', ar: 'عنّابي فاخر', en: 'Burgundy Reserve', xfont: 'Cambria', wfont: "'Noto Naskh Arabic','Amiri',serif",
      pri: '7A1F3D', acc: 'D8A48F', band: 'FBF3F5', tot: 'F2DCE3', ink: '33141F', bg: 'FFFFFF', paper: 'F8F0F2',
      inFont: '1D4ED8', inFill: 'FDF2E9', head: 'underline', kpi: 'strip', bandOn: false, grid: false, dark: false },
    { id: 'mono', ar: 'أبيض وأسود', en: 'Mono Minimal', xfont: 'Arial', wfont: "'Alexandria','IBM Plex Sans Arabic',sans-serif",
      pri: '111111', acc: 'FF4D2E', band: 'F5F5F5', tot: 'EDEDED', ink: '111111', bg: 'FFFFFF', paper: 'FFFFFF',
      inFont: '0040FF', inFill: 'FFFFFF', head: 'line', kpi: 'big', bandOn: false, grid: false, dark: false },
    { id: 'ocean', ar: 'أزرق محيطي', en: 'Ocean Teal', xfont: 'Segoe UI', wfont: "'Cairo','IBM Plex Sans Arabic',sans-serif",
      pri: '0E7490', acc: '22C1DC', band: 'ECF8FB', tot: 'CFEDF4', ink: '0C2D38', bg: 'FFFFFF', paper: 'EAF6F9',
      inFont: '1E40AF', inFill: 'F0F9FF', head: 'solid', kpi: 'cards', bandOn: true, grid: false, dark: false },
    { id: 'violet', ar: 'بنفسجي ملكي', en: 'Royal Violet', xfont: 'Verdana', wfont: "'Noto Kufi Arabic','IBM Plex Sans Arabic',sans-serif",
      pri: '4C1D95', acc: 'A78BFA', band: 'F6F2FD', tot: 'E6DCFA', ink: '24123F', bg: 'FFFFFF', paper: 'F3EFFB',
      inFont: '1D4ED8', inFill: 'FBF8FF', head: 'outline', kpi: 'strip', bandOn: true, grid: true, dark: false },
    { id: 'olive', ar: 'زيتوني هادئ', en: 'Olive Grove', xfont: 'Trebuchet MS', wfont: "'Readex Pro','Tajawal',sans-serif",
      pri: '4D5B23', acc: 'B5A642', band: 'F5F6EC', tot: 'E4E8CF', ink: '262C12', bg: 'FFFFFF', paper: 'F4F4EA',
      inFont: '1D4ED8', inFill: 'FFFBE6', head: 'line', kpi: 'cards', bandOn: true, grid: false, dark: false },
    { id: 'slate', ar: 'رمادي فولاذي', en: 'Steel Slate', xfont: 'Arial', wfont: "'IBM Plex Sans Arabic',sans-serif",
      pri: '334155', acc: 'E11D48', band: 'F1F5F9', tot: 'E2E8F0', ink: '0F172A', bg: 'FFFFFF', paper: 'EEF1F5',
      inFont: '2563EB', inFill: 'FFFFFF', head: 'solid', kpi: 'big', bandOn: false, grid: true, dark: false }
  ];

  /* ---------------- number formats ---------------- */
  function fmts(dec) {
    const d = dec ? '.0' : '';
    return {
      num: `#,##0${d};(#,##0${d});"–"`, pct: '0.0%;(0.0%);"–"', days: '0.0;(0.0);"–"', mult: '0.0"x";(0.0"x");"–"',
      ps: '#,##0.00;(#,##0.00);"–"', factor: '0.0000', per: '0.0', int: '0', beta: '0.00',
      chk: '[Red]#,##0.00;[Red](#,##0.00);"OK ✓"', shares: '#,##0.##'
    };
  }
  function fmtJS(v, kind, dec) {
    if (v === null || v === undefined || v === '') return '';
    if (typeof v !== 'number' || !isFinite(v)) return '#ERR';
    const nf = (x, d) => Math.abs(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
    const paren = (s, neg) => neg ? `(${s})` : s;
    const zero = (x, d) => Math.abs(x) < 0.5 * Math.pow(10, -d);
    switch (kind) {
      case 'pct': { const p = v * 100; return zero(p, 1) ? '–' : paren(nf(p, 1) + '%', p < 0); }
      case 'days': return zero(v, 1) ? '–' : paren(nf(v, 1), v < 0);
      case 'mult': return zero(v, 1) ? '–' : paren(nf(v, 1) + 'x', v < 0);
      case 'ps': return zero(v, 2) ? '–' : paren(nf(v, 2), v < 0);
      case 'factor': return v.toFixed(4);
      case 'per': return v.toFixed(1);
      case 'int': return String(Math.round(v));
      case 'beta': return v.toFixed(2);
      case 'shares': return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
      case 'chk': return Math.abs(v) < 0.005 ? 'OK ✓' : paren(nf(v, 2), v < 0);
      default: { const d = dec ? 1 : 0; return zero(v, d) ? '–' : paren(nf(v, d), v < 0); }
    }
  }

  /* ---------------- formula DSL ---------------- */
  const TOKEN = /\{([a-z_0-9]+)(?:@(-?\d+)|#(\d+)(?::(\d+))?)?\}/g;
  const FN = {
    MIN: (...a) => Math.min(...a.flat()), MAX: (...a) => Math.max(...a.flat()),
    SUM: (...a) => a.flat().reduce((s, x) => s + (+x || 0), 0),
    IF: (c, a, b) => (c ? a : b), ABS: Math.abs,
    ROUND: (x, d) => { const m = Math.pow(10, d); return Math.sign(x) * Math.round(Math.abs(x) * m) / m; },
    IFERROR: (x, e) => (typeof x === 'number' && isFinite(x) ? x : e)
  };
  const colLetter = (n) => { let s = ''; n++; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  function Model(meta) {
    this.meta = meta; this.sheets = []; this.rows = {};
  }
  Model.prototype.sheet = function (key, titleKey, ncols, colLabels) {
    const s = { key, titleKey, ncols, colLabels, blocks: [] };
    this.sheets.push(s); return s;
  };
  // normalise a row definition and register it
  Model.prototype.block = function (sheet, titleKey, opts, rows) {
    const b = { titleKey, series: !!opts.series, headLabels: opts.headLabels || null, rows: [] };
    for (const r of rows) {
      if (this.rows[r.id]) throw new Error('duplicate row ' + r.id);
      const cells = [];
      for (let c = 0; c < sheet.ncols; c++) {
        let x = r.cells[c];
        if (x === undefined || x === null) x = null;
        else if (typeof x === 'string') x = { f: x };
        else if (typeof x === 'number') x = { v: x, input: true };
        cells.push(x);
      }
      const row = Object.assign({ fmt: 'num', style: '' }, r, { cells, sheet });
      b.rows.push(row); this.rows[r.id] = row;
    }
    sheet.blocks.push(b); return b;
  };

  Model.prototype.layout = function () {
    for (const s of this.sheets) {
      let r = 4;
      for (const b of s.blocks) {
        b.r = r++;
        for (const row of b.rows) row.r = r++;
        r++;
      }
    }
  };

  Model.prototype.refOf = function (id) {
    const row = this.rows[id];
    if (!row) throw new Error('unknown row ' + id);
    return row;
  };

  Model.prototype.toExcel = function (expr, sheet, col, sheetName) {
    expr = expr.replace(/\{#\}/g, String(col));
    return expr.replace(TOKEN, (m, id, off, abs, abs2) => {
      const row = this.refOf(id);
      const pre = row.sheet === sheet ? '' : `'${sheetName(row.sheet)}'!`;
      if (abs2 !== undefined) return `${pre}${colLetter(+abs + 1)}${row.r}:${colLetter(+abs2 + 1)}${row.r}`;
      if (abs !== undefined) return `${pre}$${colLetter(+abs + 1)}$${row.r}`;
      if (off !== undefined) return `${pre}${colLetter(col + +off + 1)}${row.r}`;
      if (row.scalar) return `${pre}$B$${row.r}`;
      return `${pre}${colLetter(col + 1)}${row.r}`;
    });
  };

  const compiled = {};
  Model.prototype.toJS = function (expr, col) {
    let js = expr.replace(/\{#\}/g, String(col)).replace(TOKEN, (m, id, off, abs, abs2) => {
      const row = this.refOf(id);
      if (abs2 !== undefined) return `RG(${JSON.stringify(id)},${abs},${abs2})`;
      if (abs !== undefined) return `V(${JSON.stringify(id)},${abs})`;
      if (off !== undefined) return `V(${JSON.stringify(id)},${col + +off})`;
      return `V(${JSON.stringify(id)},${row.scalar ? 0 : col})`;
    });
    js = js.replace(/<>/g, '!=').replace(/(^|[^<>!=])=(?!=)/g, '$1==').replace(/\^/g, '**');
    if (!compiled[js]) compiled[js] = new Function('V', 'RG', 'MIN', 'MAX', 'SUM', 'IF', 'ABS', 'ROUND', 'IFERROR', 'return (' + js + ');');
    return compiled[js];
  };

  Model.prototype.evaluate = function () {
    const memo = {}, busy = {};
    const V = (id, col) => {
      const key = id + '|' + col;
      if (key in memo) return memo[key];
      const row = this.refOf(id), cell = row.cells[col];
      let v = 0;
      if (cell) {
        if (cell.input || cell.v !== undefined) v = +cell.v || 0;
        else {
          if (busy[key]) throw new Error('circular reference at ' + key);
          busy[key] = true;
          v = this.toJS(cell.f, col)(V, RG, FN.MIN, FN.MAX, FN.SUM, FN.IF, FN.ABS, FN.ROUND, FN.IFERROR);
          if (typeof v === 'boolean') v = v ? 1 : 0;
          busy[key] = false;
        }
      }
      memo[key] = v; return v;
    };
    const RG = (id, a, b) => { const out = []; for (let c = a; c <= b; c++) out.push(V(id, c)); return out; };
    for (const id in this.rows) {
      const row = this.rows[id];
      row.vals = row.cells.map((c, i) => (c ? V(id, i) : null));
    }
    this.V = V;
    return this;
  };

  /* ---------------- input helpers ---------------- */
  const num = (x) => { const v = +x; return isFinite(v) ? v : 0; };
  const P = (x) => num(x) / 100;

  /* ---------------- 3-statement model ---------------- */
  function buildTSM(inp) {
    const N = inp.years, s = inp.s, g = inp.g;
    const labels = [inp.baseYear + 'A'];
    for (let i = 1; i <= N; i++) labels.push((inp.baseYear + i) + 'E');
    const m = new Model({ type: 'tsm', N, labels });
    const C = N + 1;
    const scalar = (id, v, extra) => Object.assign({ id, scalar: true, cells: [v] }, extra || {});
    const fc = (c0, f) => [c0].concat(Array(N).fill(f));
    const grid = (id, kind, c0, extra) => {
      const vals = (g[id] || []).slice(0, N);
      while (vals.length < N) vals.push(vals.length ? vals[vals.length - 1] : 0);
      const cells = [c0 ? { f: c0, muted: true } : null].concat(vals.map((x) => (kind === 'pct' ? P(x) : num(x))));
      return Object.assign({ id, cells, fmt: kind === 'pct' ? 'pct' : kind === 'days' ? 'days' : 'num' }, extra || {});
    };

    const IN = m.sheet('inputs', 'sh_inputs', C, labels);
    m.block(IN, 'b_hist_is', { headLabels: [labels[0]] }, [
      scalar('h_rev', num(s.h_rev)), scalar('h_cogs', num(s.h_cogs)), scalar('h_sga', num(s.h_sga)),
      scalar('h_da', num(s.h_da)), scalar('h_int', num(s.h_int)), scalar('h_tax', num(s.h_tax)),
      scalar('h_ni', '{h_rev}-{h_cogs}-{h_sga}-{h_da}-{h_int}-{h_tax}', { style: 'total' })
    ]);
    m.block(IN, 'b_hist_bs', { headLabels: [labels[0]] }, [
      scalar('h_cash', num(s.h_cash)), scalar('h_ar', num(s.h_ar)), scalar('h_inv', num(s.h_inv)),
      scalar('h_oca', num(s.h_oca)), scalar('h_ppe', num(s.h_ppe)), scalar('h_onca', num(s.h_onca)),
      scalar('h_ta', '{h_cash}+{h_ar}+{h_inv}+{h_oca}+{h_ppe}+{h_onca}', { style: 'total' }),
      scalar('h_ap', num(s.h_ap)), scalar('h_acc', num(s.h_acc)), scalar('h_debt', num(s.h_debt)),
      scalar('h_oltl', num(s.h_oltl)), scalar('h_cs', num(s.h_cs)), scalar('h_re', num(s.h_re)),
      scalar('h_tle', '{h_ap}+{h_acc}+{h_debt}+{h_oltl}+{h_cs}+{h_re}', { style: 'total' }),
      scalar('h_chk', 'ROUND({h_ta}-{h_tle},2)', { style: 'check', fmt: 'chk' })
    ]);
    m.block(IN, 'b_assump', { series: true }, [
      grid('a_g', 'pct'),
      grid('a_gm', 'pct', 'IFERROR(({h_rev}-{h_cogs})/{h_rev},0)'),
      grid('a_sga', 'pct', 'IFERROR({h_sga}/{h_rev},0)'),
      grid('a_da', 'pct', 'IFERROR({h_da}/{h_rev},0)'),
      grid('a_capex', 'pct'),
      grid('a_dso', 'days', 'IFERROR({h_ar}/{h_rev}*365,0)'),
      grid('a_dio', 'days', 'IFERROR({h_inv}/{h_cogs}*365,0)'),
      grid('a_dpo', 'days', 'IFERROR({h_ap}/{h_cogs}*365,0)'),
      grid('a_tax', 'pct', 'IFERROR({h_tax}/({h_rev}-{h_cogs}-{h_sga}-{h_da}-{h_int}),0)'),
      grid('a_int', 'pct', 'IFERROR({h_int}/{h_debt},0)'),
      grid('a_rep', 'num'),
      grid('a_pay', 'pct')
    ]);

    const IS = m.sheet('is', 'sh_is', C, labels);
    m.block(IS, 'b_rev', { series: true }, [
      { id: 'rev', cells: fc('{h_rev}', '{rev@-1}*(1+{a_g})'), style: 'strong' },
      { id: 'revg', cells: fc(null, 'IFERROR({rev}/{rev@-1}-1,0)'), fmt: 'pct', style: 'sub' },
      { id: 'cogs', cells: fc('{h_cogs}', '{rev}*(1-{a_gm})') },
      { id: 'gp', cells: Array(C).fill('{rev}-{cogs}'), style: 'total' },
      { id: 'gm', cells: Array(C).fill('IFERROR({gp}/{rev},0)'), fmt: 'pct', style: 'sub' },
      { id: 'sga', cells: fc('{h_sga}', '{rev}*{a_sga}') },
      { id: 'ebitda', cells: Array(C).fill('{gp}-{sga}'), style: 'total' },
      { id: 'ebitdam', cells: Array(C).fill('IFERROR({ebitda}/{rev},0)'), fmt: 'pct', style: 'sub' },
      { id: 'da', cells: fc('{h_da}', '{rev}*{a_da}') },
      { id: 'ebit', cells: Array(C).fill('{ebitda}-{da}'), style: 'total' }
    ]);
    m.block(IS, 'b_below', { series: true }, [
      { id: 'int', cells: fc('{h_int}', '{debt@-1}*{a_int}') },
      { id: 'ebt', cells: Array(C).fill('{ebit}-{int}'), style: 'total' },
      { id: 'tax', cells: fc('{h_tax}', 'MAX(0,{ebt}*{a_tax})') },
      { id: 'ni', cells: Array(C).fill('{ebt}-{tax}'), style: 'grand' },
      { id: 'nm', cells: Array(C).fill('IFERROR({ni}/{rev},0)'), fmt: 'pct', style: 'sub' }
    ]);

    const BS = m.sheet('bs', 'sh_bs', C, labels);
    m.block(BS, 'b_assets', { series: true }, [
      { id: 'cash', cells: fc('{h_cash}', '{cf_end}') },
      { id: 'ar', cells: fc('{h_ar}', '{rev}*{a_dso}/365') },
      { id: 'inv', cells: fc('{h_inv}', '{cogs}*{a_dio}/365') },
      { id: 'oca', cells: fc('{h_oca}', '{oca@-1}') },
      { id: 'tca', cells: Array(C).fill('{cash}+{ar}+{inv}+{oca}'), style: 'total' },
      { id: 'ppe', cells: fc('{h_ppe}', '{ppe@-1}-{cf_capex}-{da}') },
      { id: 'onca', cells: fc('{h_onca}', '{onca@-1}') },
      { id: 'ta', cells: Array(C).fill('{tca}+{ppe}+{onca}'), style: 'grand' }
    ]);
    m.block(BS, 'b_liab', { series: true }, [
      { id: 'ap', cells: fc('{h_ap}', '{cogs}*{a_dpo}/365') },
      { id: 'acc', cells: fc('{h_acc}', '{acc@-1}') },
      { id: 'tcl', cells: Array(C).fill('{ap}+{acc}'), style: 'total' },
      { id: 'debt', cells: fc('{h_debt}', '{debt@-1}+{cf_debt}') },
      { id: 'oltl', cells: fc('{h_oltl}', '{oltl@-1}') },
      { id: 'tl', cells: Array(C).fill('{tcl}+{debt}+{oltl}'), style: 'total' }
    ]);
    m.block(BS, 'b_eq', { series: true }, [
      { id: 'cs', cells: fc('{h_cs}', '{cs@-1}') },
      { id: 're', cells: fc('{h_re}', '{re@-1}+{ni}+{cf_div}') },
      { id: 'te', cells: Array(C).fill('{cs}+{re}'), style: 'total' },
      { id: 'tle', cells: Array(C).fill('{tl}+{te}'), style: 'grand' },
      { id: 'chk', cells: Array(C).fill('ROUND({ta}-{tle},2)'), fmt: 'chk', style: 'check' }
    ]);

    const CF = m.sheet('cf', 'sh_cf', C, labels);
    m.block(CF, 'b_cfo', { series: true }, [
      { id: 'cf_ni', cells: fc(null, '{ni}') },
      { id: 'cf_da', cells: fc(null, '{da}') },
      { id: 'cf_ar', cells: fc(null, '{ar@-1}-{ar}') },
      { id: 'cf_inv', cells: fc(null, '{inv@-1}-{inv}') },
      { id: 'cf_oca', cells: fc(null, '{oca@-1}-{oca}') },
      { id: 'cf_ap', cells: fc(null, '{ap}-{ap@-1}') },
      { id: 'cf_acc', cells: fc(null, '{acc}-{acc@-1}') },
      { id: 'cfo', cells: fc(null, '{cf_ni}+{cf_da}+{cf_ar}+{cf_inv}+{cf_oca}+{cf_ap}+{cf_acc}'), style: 'total' }
    ]);
    m.block(CF, 'b_cfi', { series: true }, [
      { id: 'cf_capex', cells: fc(null, '-{rev}*{a_capex}') },
      { id: 'cfi', cells: fc(null, '{cf_capex}'), style: 'total' }
    ]);
    m.block(CF, 'b_cff', { series: true }, [
      { id: 'cf_debt', cells: fc(null, '-MIN({debt@-1},{a_rep})') },
      { id: 'cf_div', cells: fc(null, '-MAX(0,{ni})*{a_pay}') },
      { id: 'cff', cells: fc(null, '{cf_debt}+{cf_div}'), style: 'total' }
    ]);
    m.block(CF, 'b_cash', { series: true }, [
      { id: 'cf_net', cells: fc(null, '{cfo}+{cfi}+{cff}'), style: 'total' },
      { id: 'cf_beg', cells: fc(null, '{cash@-1}') },
      { id: 'cf_end', cells: fc(null, '{cf_beg}+{cf_net}'), style: 'grand' }
    ]);

    m.layout(); m.evaluate();
    const v = (id, c) => m.rows[id].vals[c];
    const r0 = v('rev', 0), rN = v('rev', N);
    m.kpis = [
      { k: 'k_rev', v: rN, fmt: 'num', sub: { k: 'k_cagr', v: r0 > 0 && rN > 0 ? Math.pow(rN / r0, 1 / N) - 1 : 0, fmt: 'pct' } },
      { k: 'k_ni', v: v('ni', N), fmt: 'num', sub: { k: 'k_nm', v: v('nm', N), fmt: 'pct' } },
      { k: 'k_cash', v: v('cash', N), fmt: 'num', sub: { k: 'k_debt', v: v('debt', N), fmt: 'num' } },
      { k: 'k_ebitda', v: v('ebitda', N), fmt: 'num', sub: { k: 'k_ebitdam', v: v('ebitdam', N), fmt: 'pct' } },
      { k: 'k_check', v: Math.max(...m.rows.chk.vals.map(Math.abs)), fmt: 'chk', check: true }
    ];
    m.chart = { labels, series: [{ k: 'rev', vals: m.rows.rev.vals }, { k: 'ni', vals: m.rows.ni.vals }] };
    return m;
  }

  /* ---------------- DCF model ---------------- */
  function buildDCF(inp) {
    const N = inp.years, s = inp.s, g = inp.g;
    const labels = [inp.baseYear + 'A'];
    for (let i = 1; i <= N; i++) labels.push((inp.baseYear + i) + 'E');
    const m = new Model({ type: 'dcf', N, labels });
    const C = N + 1;
    const scalar = (id, v, extra) => Object.assign({ id, scalar: true, cells: [v] }, extra || {});
    const fc = (c0, f) => [c0].concat(Array(N).fill(f));
    const grid = (id) => {
      const vals = (g[id] || []).slice(0, N);
      while (vals.length < N) vals.push(vals.length ? vals[vals.length - 1] : 0);
      return { id, cells: [null].concat(vals.map(P)), fmt: 'pct' };
    };
    const method = num(s.t_method) === 2 ? 2 : 1;
    const shares = num(s.e_shares);

    const IN = m.sheet('inputs', 'sh_inputs', C, labels);
    m.block(IN, 'b_base', { headLabels: [labels[0]] }, [scalar('d_rev', num(s.d_rev))]);
    m.block(IN, 'b_assump', { series: true }, ['b_g', 'b_m', 'b_da', 'b_capex', 'b_nwc', 'b_tax'].map(grid));
    m.block(IN, 'b_wacc', { headLabels: [L.value] }, [
      scalar('w_rf', P(s.w_rf), { fmt: 'pct' }), scalar('w_beta', num(s.w_beta), { fmt: 'beta' }),
      scalar('w_erp', P(s.w_erp), { fmt: 'pct' }),
      scalar('w_ke', '{w_rf}+{w_beta}*{w_erp}', { fmt: 'pct', style: 'total' }),
      scalar('w_kd', P(s.w_kd), { fmt: 'pct' }), scalar('w_tax', P(s.w_tax), { fmt: 'pct' }),
      scalar('w_kdat', '{w_kd}*(1-{w_tax})', { fmt: 'pct', style: 'total' }),
      scalar('w_wd', P(s.w_wd), { fmt: 'pct' }),
      scalar('w_we', '1-{w_wd}', { fmt: 'pct', style: 'sub' }),
      scalar('w_calc', '{w_we}*{w_ke}+{w_wd}*{w_kdat}', { fmt: 'pct', style: 'total' }),
      scalar('w_ovr', P(s.w_ovr), { fmt: 'pct' }),
      scalar('wacc', 'IF({w_ovr}>0,{w_ovr},{w_calc})', { fmt: 'pct', style: 'grand' })
    ]);
    m.block(IN, 'b_term', { headLabels: [L.value] }, [
      scalar('t_method', method, { fmt: 'int' }), scalar('t_g', P(s.t_g), { fmt: 'pct' }),
      scalar('t_mult', num(s.t_mult), { fmt: 'mult' }), scalar('t_mid', s.t_mid ? 1 : 0, { fmt: 'int' })
    ]);
    m.block(IN, 'b_bridge', { headLabels: [L.value] }, [
      scalar('e_debt', num(s.e_debt)), scalar('e_cash', num(s.e_cash)), scalar('e_min', num(s.e_min)),
      scalar('e_shares', shares, { fmt: 'shares' }), scalar('e_price', num(s.e_price), { fmt: 'ps' })
    ]);

    const D = m.sheet('dcf', 'sh_dcf', C, labels);
    m.block(D, 'b_fcf', { series: true }, [
      { id: 'rev', cells: fc('{d_rev}', '{rev@-1}*(1+{b_g})'), style: 'strong' },
      { id: 'revg', cells: fc(null, 'IFERROR({rev}/{rev@-1}-1,0)'), fmt: 'pct', style: 'sub' },
      { id: 'ebitda', cells: fc(null, '{rev}*{b_m}') },
      { id: 'ebitdam', cells: fc(null, 'IFERROR({ebitda}/{rev},0)'), fmt: 'pct', style: 'sub' },
      { id: 'da', cells: fc(null, '{rev}*{b_da}') },
      { id: 'ebit', cells: fc(null, '{ebitda}-{da}'), style: 'total' },
      { id: 'dtax', cells: fc(null, 'MAX(0,{ebit}*{b_tax})') },
      { id: 'nopat', cells: fc(null, '{ebit}-{dtax}'), style: 'total' },
      { id: 'pda', cells: fc(null, '{da}') },
      { id: 'capex', cells: fc(null, '{rev}*{b_capex}') },
      { id: 'nwc', cells: fc(null, '({rev}-{rev@-1})*{b_nwc}') },
      { id: 'fcf', cells: fc(null, '{nopat}+{pda}-{capex}-{nwc}'), style: 'grand' }
    ]);
    m.block(D, 'b_disc', { series: true }, [
      { id: 'per', cells: fc(null, '{#}-0.5*{t_mid}'), fmt: 'per', style: 'sub' },
      { id: 'df', cells: fc(null, '1/(1+{wacc})^{per}'), fmt: 'factor', style: 'sub' },
      { id: 'pv', cells: fc(null, '{fcf}*{df}'), style: 'total' }
    ]);

    // valuation sheet: 6 columns (axis + 5 sensitivity columns)
    const VC = 6;
    const V = m.sheet('val', 'sh_val', VC, null);
    const vs = (id, f, extra) => Object.assign({ id, scalar: true, cells: [f] }, extra || {});
    m.block(V, 'b_ev', {}, [
      vs('v_wacc', '{wacc}', { fmt: 'pct', style: 'sub' }),
      vs('v_sum', `SUM({pv#1:${N}})`),
      vs('v_tv', `IF({t_method}=1,{fcf#${N}}*(1+{t_g})/({wacc}-{t_g}),{ebitda#${N}}*{t_mult})`),
      vs('v_pvtv', `{v_tv}/(1+{wacc})^${N}`),
      vs('v_ev', '{v_sum}+{v_pvtv}', { style: 'grand' }),
      vs('v_tvp', 'IFERROR({v_pvtv}/{v_ev},0)', { fmt: 'pct', style: 'sub' })
    ]);
    m.block(V, 'b_eqv', {}, [
      vs('v_ev2', '{v_ev}'), vs('v_debt', '-{e_debt}'), vs('v_cash', '{e_cash}'), vs('v_min', '-{e_min}'),
      vs('v_eq', '{v_ev2}+{v_debt}+{v_cash}+{v_min}', { style: 'grand' }),
      vs('v_sh', '{e_shares}', { fmt: 'shares' }),
      vs('v_ps', 'IFERROR({v_eq}/{e_shares},0)', { fmt: 'ps', style: 'key' }),
      vs('v_px', '{e_price}', { fmt: 'ps' }),
      vs('v_up', 'IF({e_price}>0,{v_ps}/{e_price}-1,0)', { fmt: 'pct', style: 'strong' })
    ]);
    m.block(V, 'b_checks', {}, [
      vs('v_im', `IFERROR({v_tv}/{ebitda#${N}},0)`, { fmt: 'mult' }),
      vs('v_ig', `IFERROR(({v_tv}*{wacc}-{fcf#${N}})/({v_tv}+{fcf#${N}}),0)`, { fmt: 'pct' })
    ]);
    // sensitivity
    const perSh = shares > 0;
    const axisFmt = method === 1 ? 'pct' : 'mult';
    const hdr = [null];
    for (let k = 1; k <= 5; k++) hdr.push({ f: method === 1 ? `{t_g}+(${k - 3})*0.005` : `{t_mult}+(${k - 3})*1`, fmt: axisFmt, st: 'axis' });
    const sensRows = [{ id: 'sens_h', label: method === 1 ? L.sens_corner_g : L.sens_corner_m, cells: hdr, style: 'axisrow' }];
    for (let i = 1; i <= 5; i++) {
      const cells = [{ f: `{wacc}+(${i - 3})*0.01`, fmt: 'pct', st: 'axis' }];
      for (let k = 1; k <= 5; k++) {
        const W = `{sens_${i}#0}`, X = `{sens_h#${k}}`;
        let pvs = [];
        for (let y = 1; y <= N; y++) pvs.push(`{fcf#${y}}/(1+${W})^{per#${y}}`);
        const tv = method === 1 ? `{fcf#${N}}*(1+${X})/(${W}-${X})` : `{ebitda#${N}}*${X}`;
        const val = `(${pvs.join('+')}+${tv}/(1+${W})^${N}-{e_debt}+{e_cash}-{e_min})`;
        cells.push({ f: perSh ? `IFERROR(${val}/{e_shares},0)` : `IFERROR(${val},0)`, fmt: perSh ? 'ps' : 'num', st: i === 3 && k === 3 ? 'base' : '' });
      }
      sensRows.push({ id: 'sens_' + i, label: ['', ''], cells, style: 'sens' });
    }
    const sensTitle = method === 1 ? (perSh ? 'b_sens_g' : 'b_sens_g_eq') : (perSh ? 'b_sens_m' : 'b_sens_m_eq');
    m.block(V, sensTitle, {}, sensRows);

    m.layout(); m.evaluate();
    const val = (id) => m.rows[id].vals[0];
    m.kpis = [
      { k: 'k_ev', v: val('v_ev'), fmt: 'num', sub: { k: 'k_tvp', v: val('v_tvp'), fmt: 'pct' } },
      { k: 'k_eq', v: val('v_eq'), fmt: 'num' },
      perSh ? { k: 'k_ps', v: val('v_ps'), fmt: 'ps', hero: true, sub: num(s.e_price) > 0 ? { k: 'k_up', v: val('v_up'), fmt: 'pct', signed: true } : null }
        : { k: 'k_eq', v: val('v_eq'), fmt: 'num', hero: true },
      { k: 'k_wacc', v: val('v_wacc'), fmt: 'pct', sub: { k: method === 1 ? 'k_g' : 'k_mult', v: method === 1 ? P(s.t_g) : num(s.t_mult), fmt: method === 1 ? 'pct' : 'mult' } }
    ];
    m.warnings = [];
    if (method === 1 && val('v_wacc') <= P(s.t_g)) m.warnings.push('w_wacc_g');
    m.chart = { labels, series: [{ k: 'fcf', vals: m.rows.fcf.vals }, { k: 'pv', vals: m.rows.pv.vals }] };
    return m;
  }

  /* ---------------- Excel writer ---------------- */
  async function toWorkbook(ExcelJS, m, opts) {
    const lang = opts.lang === 'en' ? 1 : 0, rtl = lang === 0, t = opts.theme;
    const tx = (k) => (Array.isArray(k) ? k[lang] : (L[k] ? L[k][lang] : k));
    const F = fmts(opts.dec);
    const name = (s) => tx(s.titleKey).slice(0, 31);
    // dark themes get a light sheet in Excel but keep their header colours
    const band = t.xband || t.band, tot = t.xtot || t.tot, ink = t.xink || t.ink;
    const inFont = t.xinFont || t.inFont, inFill = t.xinFill || t.inFill;
    const A = (hex) => ({ argb: 'FF' + hex });
    const fill = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: A(hex) });
    const thin = (hex) => ({ style: 'thin', color: A(hex) });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Modeler'; wb.created = new Date();
    wb.calcProperties.fullCalcOnLoad = true;
    const font = (o) => Object.assign({ name: t.xfont, size: 10, color: A(ink) }, o || {});

    for (const s of m.sheets) {
      const ws = wb.addWorksheet(name(s), {
        properties: { tabColor: A(t.pri), defaultRowHeight: 17 },
        views: [{ rightToLeft: rtl, showGridLines: t.grid, state: 'frozen', xSplit: 1, ySplit: 3 }]
      });
      ws.getColumn(1).width = 46;
      for (let c = 0; c < s.ncols; c++) ws.getColumn(c + 2).width = s.key === 'val' ? 15 : 14;
      const last = s.ncols + 1;
      // title rows
      const title = ws.getCell(1, 1);
      title.value = `${opts.company || ''} — ${tx(s.titleKey)}`;
      title.font = font({ size: 16, bold: true, color: A(t.head === 'solid' ? 'FFFFFF' : t.pri) });
      const sub = ws.getCell(2, 1);
      sub.value = `${tx(m.meta.type === 'dcf' ? 'm_dcf' : 'm_tsm')} · ${opts.currency} ${opts.unitsLabel || ''} · ${tx('legend')}`;
      sub.font = font({ size: 9, italic: true, color: A(t.head === 'solid' ? 'E5E7EB' : '6B7280') });
      for (let c = 1; c <= last; c++) {
        if (t.head === 'solid') { ws.getCell(1, c).fill = fill(t.pri); ws.getCell(2, c).fill = fill(t.pri); }
        else ws.getCell(2, c).border = { bottom: { style: 'medium', color: A(t.acc) } };
      }
      ws.getRow(1).height = 26;
      ws.mergeCells(1, 1, 1, last); ws.mergeCells(2, 1, 2, last);
      title.alignment = sub.alignment = { horizontal: rtl ? 'right' : 'left', vertical: 'middle' };

      for (const b of s.blocks) {
        // block header
        const hr = ws.getRow(b.r);
        hr.getCell(1).value = tx(b.titleKey);
        const heads = b.series ? s.colLabels : (b.headLabels ? b.headLabels.map(tx) : []);
        heads.forEach((h, i) => { hr.getCell(i + 2).value = h; });
        for (let c = 1; c <= last; c++) {
          const cell = hr.getCell(c);
          cell.alignment = { horizontal: c === 1 ? (rtl ? 'right' : 'left') : 'center', vertical: 'middle' };
          if (t.head === 'solid') { cell.fill = fill(t.pri); cell.font = font({ bold: true, color: A('FFFFFF') }); }
          else if (t.head === 'outline') { cell.fill = fill(tot); cell.font = font({ bold: true, color: A(t.pri) }); cell.border = { top: thin(t.pri), bottom: thin(t.pri) }; }
          else if (t.head === 'line') { cell.font = font({ bold: true, color: A(t.pri), size: 11 }); cell.border = { bottom: { style: 'thick', color: A(t.acc) } }; }
          else { cell.font = font({ bold: true, color: A(t.pri), size: 11 }); cell.border = { bottom: { style: 'medium', color: A(t.pri) } }; }
        }
        hr.height = 20;

        b.rows.forEach((row, ri) => {
          const xr = ws.getRow(row.r);
          const lc = xr.getCell(1);
          lc.value = row.label ? tx(row.label) : tx(row.id);
          const bold = /total|grand|strong|key|axisrow/.test(row.style);
          const italic = row.style === 'sub';
          lc.font = font({ bold, italic, color: A(italic ? '6B7280' : ink) });
          lc.alignment = { indent: bold || row.style === 'sens' ? 0 : 1, horizontal: rtl ? 'right' : 'left' };
          for (let c = 0; c < s.ncols; c++) {
            const cell = xr.getCell(c + 2), def = row.cells[c];
            if (def) {
              if (def.input) cell.value = def.v;
              else cell.value = { formula: m.toExcel(def.f, s, c, name), result: row.vals[c] };
              cell.numFmt = F[def.fmt || row.fmt] || F.num;
              const isIn = !!def.input;
              cell.font = font({
                bold: bold || def.st === 'axis' || def.st === 'base',
                italic: italic || def.muted,
                color: A(isIn ? inFont : (italic || def.muted) ? '6B7280' : row.style === 'check' ? '15803D' : ink)
              });
              if (isIn) { cell.fill = fill(inFill); cell.border = { top: thin('D1D5DB'), bottom: thin('D1D5DB'), left: thin('D1D5DB'), right: thin('D1D5DB') }; }
              if (def.st === 'axis') cell.fill = fill(tot);
              if (def.st === 'base') { cell.fill = fill(t.acc); cell.font = font({ bold: true, color: A('FFFFFF') }); }
            }
            cell.alignment = { horizontal: 'right' };
          }
          // row decoration
          for (let c = 1; c <= last; c++) {
            const cell = xr.getCell(c), def = c > 1 ? row.cells[c - 2] : null;
            if (def && (def.input || def.st)) continue;
            if (row.style === 'grand') { cell.fill = fill(tot); cell.border = { top: thin(t.pri), bottom: { style: 'double', color: A(t.pri) } }; }
            else if (row.style === 'total') cell.border = { top: thin('9CA3AF') };
            else if (row.style === 'key') { cell.fill = fill(t.acc); cell.font = font({ bold: true, size: 12, color: A('FFFFFF') }); }
            else if (t.bandOn && ri % 2 === 1 && row.style !== 'sens') cell.fill = fill(band);
          }
        });
      }
      ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    }
    return wb;
  }

  const api = { L, THEMES, buildTSM, buildDCF, toWorkbook, fmtJS, fmts, colLetter };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
