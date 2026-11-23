from pathlib import Path
from reportlab.lib.colors import HexColor, white
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Table, TableStyle, KeepTogether, PageBreak)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/pdf/Pista_House_Progress_Report.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
for name, file in [('Body', 'segoeui.ttf'), ('Bold', 'seguisb.ttf'), ('Display', 'georgia.ttf')]:
    pdfmetrics.registerFont(TTFont(name, 'C:/Windows/Fonts/' + file))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='Bold', italic='Body', boldItalic='Bold')

GREEN = HexColor('#17613B'); INK = HexColor('#202820'); GOLD = HexColor('#B59A5B')
CREAM = HexColor('#F7F3E9'); MUTED = HexColor('#637165'); LINE = HexColor('#DCDDCF')
OK = HexColor('#2E7D4F'); WARN = HexColor('#B7791F'); TODO = HexColor('#9B2C1F')
W, H = A4

def st(name, **kw):
    base = dict(fontName='Body', fontSize=10, leading=14.5, textColor=INK)
    base.update(kw)
    return ParagraphStyle(name, **base)

S = {
    'h1': st('h1', fontName='Display', fontSize=24, leading=28, textColor=GREEN, spaceAfter=4),
    'h2': st('h2', fontName='Display', fontSize=15, leading=19, textColor=GREEN, spaceBefore=14, spaceAfter=6),
    'sub': st('sub', textColor=MUTED, fontSize=10.5),
    'p': st('p', spaceAfter=4),
    'small': st('small', fontSize=8.6, leading=12, textColor=MUTED),
    'cell': st('cell', fontSize=9.2, leading=12.6),
    'cellb': st('cellb', fontName='Bold', fontSize=9.2, leading=12.6),
    'head': st('head', fontName='Bold', fontSize=9, leading=12, textColor=white),
    'bul': st('bul', leftIndent=12, bulletIndent=1, spaceAfter=2.5),
    'big': st('big', fontName='Display', fontSize=22, leading=24, textColor=GREEN, alignment=1),
    'cap': st('cap', fontSize=8.4, leading=11, textColor=MUTED, alignment=1),
}

def P(t, s='p'): return Paragraph(t, S[s])
def B(t): return Paragraph(t, S['bul'], bulletText='•')
def pill(text, color): return Paragraph(f'<font color="{color.hexval()}"><b>{text}</b></font>', S['cell'])

def table(rows, widths, head=True, zebra=True):
    data = [[c if not isinstance(c, str) else Paragraph(c, S['head'] if (head and i == 0) else S['cell'])
             for c in r] for i, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    style = [('VALIGN', (0, 0), (-1, -1), 'TOP'), ('LEFTPADDING', (0, 0), (-1, -1), 7),
             ('RIGHTPADDING', (0, 0), (-1, -1), 7), ('TOPPADDING', (0, 0), (-1, -1), 5),
             ('BOTTOMPADDING', (0, 0), (-1, -1), 5), ('LINEBELOW', (0, 0), (-1, -1), 0.4, LINE)]
    if head: style += [('BACKGROUND', (0, 0), (-1, 0), GREEN)]
    if zebra:
        for i in range(1 if head else 0, len(rows)):
            if i % 2 == 0: style.append(('BACKGROUND', (0, i), (-1, i), HexColor('#FBF8F0')))
    t.setStyle(TableStyle(style))
    return t

def page(c, doc):
    c.saveState()
    c.setFillColor(CREAM); c.rect(0, 0, W, H, fill=1, stroke=0)
    c.setFillColor(GREEN); c.rect(0, H - 9 * mm, W, 9 * mm, fill=1, stroke=0)
    c.setFillColor(GOLD); c.rect(0, H - 10 * mm, W, 1 * mm, fill=1, stroke=0)
    c.setFont('Bold', 8.5); c.setFillColor(white)
    c.drawString(18 * mm, H - 6.2 * mm, 'PISTA HOUSE SHANKARPALLY')
    c.drawRightString(W - 18 * mm, H - 6.2 * mm, 'Progress report · 23 Nov 2026')
    c.setFont('Body', 8); c.setFillColor(MUTED)
    c.drawString(18 * mm, 10 * mm, 'Status as of commit c3b0f45, branch codex/maps-live-tracking')
    c.drawRightString(W - 18 * mm, 10 * mm, f'Page {doc.page}')
    c.restoreState()

doc = BaseDocTemplate(str(OUT), pagesize=A4, title='Pista House Shankarpally | Progress report',
                      author='Pista House Project', leftMargin=18 * mm, rightMargin=18 * mm,
                      topMargin=20 * mm, bottomMargin=18 * mm)
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(18 * mm, 18 * mm, W - 36 * mm, H - 38 * mm, id='f',
                                                         leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)],
                                   onPage=page)])
CW = W - 36 * mm
s = []

# ---- page 1 -------------------------------------------------------------
s += [P('Progress report', 'h1'),
      P('Food ordering, delivery and support for Pista House Shankarpally: customer app, owner app, rider app '
        'and staff dashboard on one server.', 'sub'), Spacer(1, 8)]

stats = [('94', 'backend tests passing'), ('62', 'app and package tests passing'), ('4', 'surfaces built'), ('3', 'iOS builds started')]
cells = [[Paragraph(n, S['big']), ] for n, _ in stats]
t = Table([[Paragraph(n, S['big']) for n, _ in stats], [Paragraph(c, S['cap']) for _, c in stats]],
          colWidths=[CW / 4] * 4)
t.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), white), ('BOX', (0, 0), (-1, -1), 0.5, LINE),
                       ('LINEAFTER', (0, 0), (-2, -1), 0.4, LINE), ('TOPPADDING', (0, 0), (-1, 0), 10),
                       ('BOTTOMPADDING', (0, 1), (-1, 1), 9), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE')]))
s += [t, Spacer(1, 6),
      P('Counts are from the last full runs. Tests run in parallel against their own database.', 'small')]

s += [P('Where we are', 'h2'),
      P('The product features are largely built and tested in software. It is <b>not yet ready for real customers</b>: '
        'the remaining work is mostly accounts and set-up that only the owner can do (payments, hosting, push), '
        'plus real-world testing. Estimated 2–4 weeks to a small closed pilot.'),
      P('What is built', 'h2')]

built = [
    ['Area', 'What works', 'State'],
    ['Ordering and menu', 'Redesigned home, menu, cart, checkout with map pin picker, saved address book, order history and reorder.', pill('Built', OK)],
    ['Accounts', 'Registration, password login, email verification and reset codes (free provider), role-based staff access.', pill('Built', OK)],
    ['Live tracking and ETA', 'Order-scoped live map for customer and owner, dead-reckoning smoothing, staged ETA with confidence.', pill('Built', OK)],
    ['Dispatch and rider app', 'Automatic assignment (cost matching, fairness), offers with expiry, rider map and route to customer.', pill('Built', OK)],
    ['Payments and refunds', 'Payment page and gateway-agnostic APIs, owner refund screen. Runs in <b>simulated mode</b>.', pill('Simulated', WARN)],
    ['Support desk', 'Customer requests with up to 3 photos, owner/counter inbox, replies, private notes, SLA flags, ratings.', pill('Built', OK)],
    ['Notifications', 'In-app inbox, order/rider/refund/support alerts, opt-in reminders, caps and quiet hours, owner report.', pill('Built*', WARN)],
    ['Staff dashboard', 'Orders, kitchen, delivery desk, menu, team and the new Support desk with desktop alerts.', pill('Built', OK)],
]
s += [table(built, [32 * mm, CW - 32 * mm - 22 * mm, 22 * mm]),
      Spacer(1, 4), P('* Alerts reach a phone only while the app is open until Firebase push is connected (see page 2).', 'small'),
      PageBreak()]

# ---- page 2 -------------------------------------------------------------
s += [P('This session: notifications, photos, support desk', 'h1'), Spacer(1, 4),
      P('Delivered in this stretch, all committed and pushed to <b>codex/maps-live-tracking</b>.', 'sub')]

s += [P('Notifications', 'h2')]
s += [B('<b>Priority tiers.</b> Order and delivery updates (p0) are never capped or delayed. Reminders (p1) and promotions (p2) '
        'need the customer to opt in, are capped per day, and are held during quiet hours (10 pm to 8 am).'),
      B('<b>Event-driven.</b> New order, accepted, preparing, ready, rider assigned, on the way, delivered, refund started, '
        'and support replies each alert the right person once. Old history is never replayed.'),
      B('<b>Campaigns.</b> Reorder at the usual time, forgotten cart, lapsed customer, rainy day. Sent only inside the '
        'customer’s own meal window; copy chosen by a bandit; a 10% holdout measures real lift.'),
      B('<b>Honest by design.</b> No invented discounts or crowd numbers. Flash deals, cultural-event campaigns, rating '
        'prompts, SMS/WhatsApp fallback and the taste-graph recommender are <b>not built</b>.')]

s += [P('Support photos', 'h2'),
      B('Up to 3 JPEG, PNG or WebP photos (800 KB each) per request or reply. The server checks real file type, not the name.'),
      B('Only the customer who sent a photo and support staff can open it. Photos on private notes stay hidden from the customer.'),
      B('Photos are deleted after 90 days; the conversation text stays.')]

s += [P('Apps and dashboard', 'h2'),
      B('<b>Customer app:</b> notification bell and inbox, reminder and offer switches, cart sync, photo attach on requests and replies.'),
      B('<b>Owner and rider apps:</b> notification bell; owner sees photos on tickets.'),
      B('<b>Dashboard:</b> new Support tab for owner and counter: queue with filters, thread view with photos, reply, '
        'private note, mark resolved.')]

s += [P('Quality work', 'h2'),
      B('Tests were sharing a database with the running beta server, whose alert poller raced them and caused random failures. '
        'Tests now use their own database; the suite passed 4 of 4 parallel runs.'),
      B('API contract is now version 0.11.0 with the new endpoints; generated types are refreshed.')]

s += [P('Deployment status', 'h2'),
      table([['Item', 'Status'],
             ['Beta API restart with new code', pill('Done: health OK, new routes live', OK)],
             ['Customer iOS build', pill('Build #9 started on cb552d8', WARN)],
             ['Owner iOS build', pill('Build #5 started on cb552d8', WARN)],
             ['Rider (delivery) iOS build', pill('Build #5 started on cb552d8', WARN)]],
            [CW * 0.55, CW * 0.45]),
      Spacer(1, 3), P('Builds were queued; their outcome has not been checked yet.', 'small'), PageBreak()]

# ---- page 3 -------------------------------------------------------------
s += [P('What stands between us and production', 'h1'), Spacer(1, 4),
      P('Ordered by how much each item blocks a real launch.', 'sub'), Spacer(1, 6)]

block = [
    ['#', 'Blocker', 'What is needed', 'Who'],
    ['1', 'Real payments', 'Razorpay (or similar) account, live keys and webhook secret; test a real payment and refund end to end.', 'You'],
    ['2', 'Hosting', 'The server runs on your PC behind a temporary tunnel link. Needs an always-on server, stable domain, HTTPS, backups and monitoring.', 'You + me'],
    ['3', 'Phone push', 'Firebase project and service key, Apple push key, config files, firebase_messaging plugin, iOS push entitlement. The Firebase code is tested only against a fake server.', 'You + me'],
    ['4', 'Verification and email', 'Phone code (OTP) is not configured; email needs a proper sender domain for volume.', 'You'],
    ['5', 'Store release', 'App Store listings, privacy policy and terms, review; Play Store if Android is wanted. Today the apps are internal TestFlight only.', 'You'],
]
s += [table(block, [8 * mm, 30 * mm, CW - 8 * mm - 30 * mm - 18 * mm, 18 * mm]), Spacer(1, 10)]

s += [P('Should be done before launch', 'h2'),
      B('<b>Real-device pilot:</b> full order-to-delivery on actual phones with a real rider, background GPS, weak network.'),
      B('<b>Load and abuse testing:</b> not yet run.'),
      B('<b>POS link (Petpooja):</b> integration not configured.'),
      B('<b>Legal review for India:</b> wording for promotional-message consent and data retention.')]

s += [P('Suggested path', 'h2'),
      table([['Step', 'Outcome'],
             ['1. Set up hosting and a stable domain', 'Apps point at a permanent server; no more tunnel links.'],
             ['2. Connect live payments and test a refund', 'Money moves for real, in a controlled test.'],
             ['3. Connect Firebase and Apple push', 'Customers and riders are alerted with the app closed.'],
             ['4. Closed pilot: a handful of real orders', 'Find real-world issues cheaply.'],
             ['5. Store submission and launch', 'Public release.']],
            [CW * 0.45, CW * 0.55]),
      Spacer(1, 10),
      P('<b>Bottom line:</b> the software is about 80% there. The remaining gap is set-up, accounts and real-world testing, '
        'not new features.', 'p')]

doc.build(s)
print(OUT)
