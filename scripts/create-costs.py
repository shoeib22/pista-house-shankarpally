from pathlib import Path
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/Pista_House_Monthly_Costs.xlsx'
OUT.parent.mkdir(parents=True, exist_ok=True)

GREEN = '17613B'; CREAM = 'F7F3E9'; INPUT = 'FFF4CC'
head = Font(bold=True, color='FFFFFF'); hfill = PatternFill('solid', fgColor=GREEN)
inp = PatternFill('solid', fgColor=INPUT); bold = Font(bold=True)
thin = Border(bottom=Side(style='thin', color='DDDDCF'))
INR = '"₹"#,##0'; INR2 = '"₹"#,##0.00'

wb = Workbook()

# ---------------- Assumptions ----------------
a = wb.active; a.title = 'Assumptions'
a['A1'] = 'Assumptions (yellow cells are inputs: overwrite with your real quotes)'; a['A1'].font = Font(bold=True, size=13, color=GREEN)
a['A2'] = 'All prices are my estimates of typical India rates, not quotes. Verify each before budgeting.'
rows = [
    ('Volume', None, None),
    ('Days open per month', 30, 'days'),
    ('Average order value', 450, '₹ incl. tax'),
    ('Share of orders that are delivery', 0.7, 'fraction'),
    ('Orders per day: Low / Medium / High', None, 'see Monthly sheet row 4'),
    ('Payments', None, None),
    ('Gateway fee on online payments (Razorpay-style)', 0.02, 'fraction of order value'),
    ('GST on gateway fee', 0.18, 'fraction'),
    ('Share of orders paid online', 0.85, 'fraction'),
    ('Messaging', None, None),
    ('Order SMS/OTP cost per message', 0.25, '₹ (DLT-registered, bulk)'),
    ('OTP / login SMS per customer order (avg)', 0.3, 'messages per order'),
    ('WhatsApp utility message cost', 0.15, '₹ per message (Meta + provider)'),
    ('WhatsApp status messages per order (if enabled)', 3, 'messages per order'),
    ('Share of orders using WhatsApp updates', 0.5, 'fraction (0 = not used)'),
    ('Email per month (free tier covers low volume)', 0, '₹'),
    ('Push notifications (Firebase)', 0, '₹ (free)'),
    ('Delivery', None, None),
    ('Rider payout per delivery', 35, '₹'),
    ('Average delivery distance', 3.5, 'km one way'),
    ('Fuel + wear if you supply the bikes', 4, '₹ per km (round trip counted)'),
    ('Share of deliveries on your own bikes', 0.0, 'fraction (0 = riders use own bike, covered by payout)'),
    ('Rider insurance / accident cover', 400, '₹ per rider per month'),
    ('Number of riders (Low / Medium / High)', None, 'see Monthly sheet'),
    ('Rider phone data allowance', 200, '₹ per rider per month'),
    ('Delivery bags / uniforms (amortised)', 150, '₹ per rider per month'),
    ('Delivery fee charged to customer (income, offsets cost)', 30, '₹ per delivery'),
    ('Tech and tools', None, None),
    ('Server hosting (VPS or home-lab power + internet)', 2500, '₹ per month'),
    ('Domain + DNS (annual ÷ 12)', 70, '₹ per month'),
    ('Backups / object storage', 400, '₹ per month'),
    ('Monitoring + error tracking', 0, '₹ per month (free tiers)'),
    ('Apple Developer Program ($99/yr)', 710, '₹ per month (~₹8,500 ÷ 12)'),
    ('Google Play (one-time $25) amortised', 0, '₹ per month'),
    ('Codemagic builds (free tier, then pay-as-you-go)', 500, '₹ per month'),
    ('Map tiles / geocoding (OpenStreetMap-based: free at low volume)', 0, '₹ per month (a paid map API would cost more)'),
    ('Support and maintenance (your fee)', 15000, '₹ per month (from the agreement; set to 0 if none)'),
    ('Shop operations (rough, not software)', None, None),
    ('Packaging per order', 12, '₹'),
    ('Kitchen staff + counter (monthly)', 60000, '₹ (placeholder, replace)'),
    ('Rent + utilities', 40000, '₹ (placeholder, replace)'),
    ('Raw material cost', 0.35, 'fraction of sales'),
    ('Licences / compliance (FSSAI, GST filing, accountant)', 4000, '₹ per month'),
]
a.append([]); a.append(['Item', 'Value', 'Unit / note'])
for c in a[4]: c.font = head; c.fill = hfill
ref = {}
r = 5
for name, val, note in rows:
    a.cell(r, 1, name); a.cell(r, 3, note)
    if val is None and note in (None, 'see Monthly sheet row 4', 'see Monthly sheet'):
        if note is None: a.cell(r, 1).font = bold; a.cell(r, 1).fill = PatternFill('solid', fgColor=CREAM)
    if val is not None:
        c = a.cell(r, 2, val); c.fill = inp
        if isinstance(val, float) and val < 1: c.number_format = '0.0%'
        ref[name] = f'Assumptions!$B${r}'
    r += 1
a.column_dimensions['A'].width = 62; a.column_dimensions['B'].width = 14; a.column_dimensions['C'].width = 52

def R(key):
    for k, v in ref.items():
        if k.startswith(key): return v
    raise KeyError(key)

# ---------------- Monthly ----------------
m = wb.create_sheet('Monthly (OPEX)')
m['A1'] = 'Monthly running costs (OPEX) by volume scenario'; m['A1'].font = Font(bold=True, size=13, color=GREEN)
m.append([]); m.append(['Scenario', 'Low', 'Medium', 'High'])
for c in m[3]: c.font = head; c.fill = hfill
m.append(['Orders per day', 40, 120, 300])
m.append(['Riders on the roster', 3, 8, 18])
for col in 'BCD':
    m[f'{col}4'].fill = inp; m[f'{col}5'].fill = inp
m.append(['Orders per month'] + [f'={c}4*{R("Days open")}' for c in 'BCD'])
m.append(['Delivery orders per month'] + [f'={c}6*{R("Share of orders that are delivery")}' for c in 'BCD'])
m.append(['Sales per month (₹)'] + [f'={c}6*{R("Average order value")}' for c in 'BCD'])

sections = []
def section(title, items):
    m.append([]); row = m.max_row + 1
    m.append([title]); m.cell(row, 1).font = bold
    for c in range(1, 5): m.cell(row, c).fill = PatternFill('solid', fgColor=CREAM)
    start = m.max_row + 1
    for label, f in items:
        m.append([label] + [f(c) for c in 'BCD'])
    end = m.max_row
    m.append([f'Subtotal: {title}'] + [f'=SUM({c}{start}:{c}{end})' for c in 'BCD'])
    for c in range(1, 5): m.cell(m.max_row, c).font = bold
    sections.append(m.max_row)

section('Payments', [
    ('Gateway fees incl. GST', lambda c: f'={c}8*{R("Share of orders paid")}*{R("Gateway fee")}*(1+{R("GST on gateway")})'),
])
section('Messaging', [
    ('Order/login SMS', lambda c: f'={c}6*{R("OTP / login SMS")}*{R("Order SMS")}'),
    ('WhatsApp order updates', lambda c: f'={c}6*{R("Share of orders using WhatsApp")}*{R("WhatsApp status")}*{R("WhatsApp utility")}'),
    ('Email', lambda c: f'={R("Email per month")}'),
    ('Push notifications (Firebase)', lambda c: f'={R("Push notifications")}'),
])
section('Delivery (all delivery expenses)', [
    ('Rider payouts', lambda c: f'={c}7*{R("Rider payout")}'),
    ('Fuel and wear on your own bikes', lambda c: f'={c}7*{R("Share of deliveries on your own")}*{R("Average delivery distance")}*2*{R("Fuel + wear")}'),
    ('Rider insurance', lambda c: f'={c}5*{R("Rider insurance")}'),
    ('Rider phone data', lambda c: f'={c}5*{R("Rider phone data")}'),
    ('Bags and uniforms', lambda c: f'={c}5*{R("Delivery bags")}'),
    ('Less: delivery fee collected from customers', lambda c: f'=-{c}7*{R("Delivery fee charged")}'),
])
section('Tech and tools', [
    ('Server hosting', lambda c: f'={R("Server hosting")}'),
    ('Domain', lambda c: f'={R("Domain")}'),
    ('Backups', lambda c: f'={R("Backups")}'),
    ('Monitoring', lambda c: f'={R("Monitoring")}'),
    ('Apple Developer Program', lambda c: f'={R("Apple Developer")}'),
    ('Google Play (amortised)', lambda c: f'={R("Google Play")}'),
    ('Build service', lambda c: f'={R("Codemagic")}'),
    ('Map services', lambda c: f'={R("Map tiles")}'),
    ('Support and maintenance fee', lambda c: f'={R("Support and maintenance")}'),
])
section('Shop operations (outside the software)', [
    ('Packaging', lambda c: f'={c}6*{R("Packaging")}'),
    ('Staff', lambda c: f'={R("Kitchen staff")}'),
    ('Rent and utilities', lambda c: f'={R("Rent")}'),
    ('Raw material', lambda c: f'={c}8*{R("Raw material")}'),
    ('Licences and accounting', lambda c: f'={R("Licences")}'),
])
m.append([]); tot = m.max_row + 1
m.append(['TOTAL MONTHLY OPEX'] + [f'=' + '+'.join(f'{c}{s}' for s in sections) for c in 'BCD'])
tech_rows = sections[:4]
m.append(['  of which software, messaging, payments and delivery'] + [f'=' + '+'.join(f'{c}{s}' for s in sections[:4]) for c in 'BCD'])
m.append(['Cost per order (all-in, ₹)'] + [f'={c}{tot}/{c}6' for c in 'BCD'])
m.append(['Cost per order: software + messaging + payments + delivery (₹)'] + [f'={c}{tot+1}/{c}6' for c in 'BCD'])
m.append(['Sales per month (₹)'] + [f'={c}8' for c in 'BCD'])
m.append(['Operating profit before tax (₹)'] + [f'={c}{tot+4}-{c}{tot}' for c in 'BCD'])
for rr in (tot, tot + 1, tot + 5):
    for c in range(1, 5): m.cell(rr, c).font = bold
for row in m.iter_rows(min_row=4, max_row=m.max_row, min_col=2, max_col=4):
    for c in row: c.number_format = INR
for rr in (tot + 2, tot + 3):
    for c in 'BCD': m[f'{c}{rr}'].number_format = INR2
for rr in (4, 5, 6, 7):
    for c in 'BCD': m[f'{c}{rr}'].number_format = '#,##0'
m.column_dimensions['A'].width = 62
for c in 'BCD': m.column_dimensions[c].width = 16

# ---------------- CAPEX ----------------
k = wb.create_sheet('CAPEX (one-time)')
k['A1'] = 'One-time set-up costs (CAPEX)'; k['A1'].font = Font(bold=True, size=13, color=GREEN)
k.append([]); k.append(['Item', 'Qty', 'Unit cost (₹)', 'Total (₹)', 'Note'])
for c in k[3]: c.font = head; c.fill = hfill
capex = [
    ('Server hardware (home-lab rackmount) or skip if using VPS', 1, 60000, 'Only if self-hosting; UPS and networking extra'),
    ('UPS + router/failover internet', 1, 12000, 'Keeps self-hosted server online'),
    ('Kitchen/counter tablets or phones (KOT, owner app)', 2, 12000, ''),
    ('Bluetooth/thermal receipt printers (KOT)', 2, 5000, ''),
    ('Rider phones (if you supply them)', 3, 9000, 'Set to 0 if riders use their own'),
    ('Rider bikes (if you supply them)', 0, 90000, 'Leave 0 if riders use own bikes'),
    ('Delivery bags, helmets, uniforms (initial)', 6, 1500, ''),
    ('Logo/signage/print for QR table and packaging', 1, 15000, ''),
    ('Software build fee (from the agreement)', 1, 0, 'Enter the agreed total'),
    ('Apple Developer first year (paid up front)', 1, 8500, 'Already counted monthly in OPEX; avoid double counting'),
    ('Google Play one-time registration', 1, 2100, '$25, optional'),
    ('Legal: agreements, privacy policy, T&Cs review', 1, 15000, 'Lawyer fee estimate'),
    ('Business registration, FSSAI, GST set-up', 1, 8000, 'Government fees plus agent'),
    ('Payment-gateway onboarding / KYC', 1, 0, 'Usually free; paperwork time only'),
    ('DLT registration for SMS (entity + templates)', 1, 6000, 'Needed for transactional SMS in India'),
    ('Launch marketing budget', 1, 20000, 'Flyers, opening offers; your call'),
    ('Contingency (10%)', None, None, 'Added automatically'),
]
start = k.max_row + 1
for name, q, u, note in capex:
    if q is None: continue
    k.append([name, q, u, f'=B{k.max_row + 1}*C{k.max_row + 1}', note])
    k.cell(k.max_row, 2).fill = inp; k.cell(k.max_row, 3).fill = inp
end = k.max_row
k.append(['Contingency (10%)', None, None, f'=ROUND(SUM(D{start}:D{end})*0.1,0)', ''])
k.append(['TOTAL CAPEX', None, None, f'=SUM(D{start}:D{k.max_row})', ''])
for c in range(1, 6): k.cell(k.max_row, c).font = bold
k.append(['Amortised over 24 months (₹ per month)', None, None, f'=D{k.max_row}/24', 'For comparing with OPEX'])
for row in k.iter_rows(min_row=4, max_row=k.max_row, min_col=3, max_col=4):
    for c in row: c.number_format = INR
k.column_dimensions['A'].width = 58; k.column_dimensions['E'].width = 56
for c in 'BCD': k.column_dimensions[c].width = 15

# ---------------- Notes ----------------
n = wb.create_sheet('Notes')
for line in [
    'How to read this workbook',
    '1. Assumptions: change yellow cells. Everything else recalculates.',
    '2. Monthly (OPEX): Low / Medium / High orders per day (row 4) and riders (row 5) can be edited too.',
    '3. CAPEX: one-time costs, plus the total spread over 24 months for comparison.',
    '',
    'Things worth knowing',
    '- Delivery is the largest line after food and staff. Rider payout is a guess: replace with your real rate.',
    '- Payment gateway fees are usually about 2% plus GST on card/UPI; UPI rates can differ. Get your actual quote.',
    '- SMS and WhatsApp costs depend on provider, volume and template category. WhatsApp business messages are priced per template message by Meta.',
    '- Push notifications through Firebase are free. Email can stay free at small volume.',
    '- If you self-host (home lab), power and internet go in server hosting; a VPS is typically cheaper to start.',
    '- Staff, rent and raw material are placeholders so the profit line is not misleading. Replace them.',
    '- Apple fee appears in OPEX (monthly) and in CAPEX (first year paid up front). Do not count both in the same budget.',
    '- This is not accounting or tax advice.',
]:
    n.append([line])
n['A1'].font = Font(bold=True, size=13, color=GREEN); n['A6'].font = bold
n.column_dimensions['A'].width = 120

wb.move_sheet('Monthly (OPEX)', offset=-1)
wb.save(OUT)
print(OUT)
