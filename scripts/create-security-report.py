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
OUT = ROOT / 'output/pdf/Pista_House_Security_Report.pdf'
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
    c.drawRightString(W - 18 * mm, H - 6.2 * mm, 'Security report · 24 Nov 2026')
    c.setFont('Body', 8); c.setFillColor(MUTED)
    c.drawString(18 * mm, 10 * mm, 'Beta server and source as of 24 Nov 2026')
    c.drawRightString(W - 18 * mm, 10 * mm, f'Page {doc.page}')
    c.restoreState()

doc = BaseDocTemplate(str(OUT), pagesize=A4, title='Pista House Shankarpally | Security report',
                      author='Pista House Project', leftMargin=18 * mm, rightMargin=18 * mm,
                      topMargin=20 * mm, bottomMargin=18 * mm)
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(18 * mm, 18 * mm, W - 36 * mm, H - 38 * mm, id='f',
                                                         leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)],
                                   onPage=page)])
CW = W - 36 * mm
s = []



def sev(t):
    c={'High':TODO,'Medium':WARN,'Low':MUTED,'Fixed':OK,'Open':TODO,'Accepted':MUTED,'Needs you':WARN}[t]
    return pill(t,c)
s += [P('Security report','h1'),
      P('What was checked, what was changed, what is still open. Scope: the API server, staff dashboard, customer, owner and rider apps, and the beta hosting set-up.','sub'),Spacer(1,8),
      P('Summary','h2'),
      P('The core design was already sound: passwords are hashed with scrypt, sessions are server-side and revocable, every customer-data route checks ownership, and sign-in is throttled in the database. '
        'This pass added the missing outer layer (response headers, request-rate limits, correct client addresses behind the tunnel, a locked-down dashboard policy, Android backup and cleartext off) and fixed one test that would have failed after a date passed. '
        'It is <b>not</b> an external penetration test. Real payments, push and email are not connected, so those areas are untested against live services.'),
      Spacer(1,6),
      P('What I checked and found already good','h2')]
for t in ['<b>Passwords:</b> scrypt (128 MiB, per-user salt), constant-time compare, a dummy hash so unknown accounts cost the same time, concurrency cap against memory exhaustion.',
          '<b>Sessions:</b> random 256-bit tokens, only the SHA-256 hash is stored, 8-hour life, revoked when a password changes or an account is disabled, per-device session list and "log out everywhere".',
          '<b>Sign-in throttle:</b> database-backed, per address (30) and per account (8) in 15 minutes, 429 on excess; invitations and recovery links are single-use tokens.',
          '<b>Authorization:</b> orders, addresses, tickets, ratings, offers and photos filter by the signed-in person; owner-only actions (offers, team, audit) reject other roles; riders reach only their own tasks.',
          '<b>Uploads:</b> photos are type-checked by content bytes, size-capped, served only to the owner or staff with nosniff and a sealed content policy.',
          '<b>Payments:</b> webhooks are verified by signature on the raw bytes, replays are de-duplicated, and test payment routes are refused outside development.',
          '<b>Secrets:</b> no keys, passwords or private keys in the git history scan; env files are ignored; the app cannot start in production with test adapters on.',
          '<b>Apps:</b> the sign-in token is kept in memory only, never written to phone storage; the saved server address must be https; the dashboard keeps its token for one browser tab only.']:
    s.append(B(t))
s += [P('Findings and actions','h2'),
 table([['#','Finding','Severity','Status'],
  ['1','No security headers on API responses (framing, sniffing, caching).','Medium',sev('Fixed')],
  ['2','No general request-rate limit; one address could flood the menu or any route.','Medium',sev('Fixed')],
  ['3','Behind the tunnel every request looked like it came from the server itself, so the per-address sign-in limit would have been shared by the whole world: 30 bad attempts from anyone could lock everyone out.','High',sev('Fixed')],
  ['4','Dashboard had no content policy; a script injected into the page could read the staff token.','Medium',sev('Fixed')],
  ['5','Android release builds allowed device backup and did not forbid plain HTTP.','Low',sev('Fixed')],
  ['6','A notifications test hard-coded last night\'s date and began failing today.','Low',sev('Fixed')],
  ['7','Server error for malformed JSON repeats the parser\'s message.','Low',sev('Open')],
  ['8','Public health page lists which services are configured. Used by the build checks, so kept.','Low',sev('Accepted')],
  ['9','Dev tools (Prisma command line) pull in a library with a known slow-pattern flaw. Not shipped in the running server; fixing needs a major upgrade.','Low',sev('Accepted')],
  ['10','Staff dashboard token lives in browser tab storage; a stolen laptop session works until it expires (8 h) or is revoked.','Low',sev('Accepted')]],
  [CW*0.05,CW*0.63,CW*0.14,CW*0.18]),
 Spacer(1,8),
 P('Live probe results (beta server)','h2'),
 table([['Attempt','Result'],
  ['Orders, audit, tickets without a token, or with a made-up token','401 rejected'],
  ['Development login and development payment','Disabled (503 / 401)'],
  ['Login with an SQL-injection string','400 rejected, nothing executed'],
  ['5 MB request body','413 rejected (limit 4 MB)'],
  ['Cross-origin request from a hostile website','Browser blocked; only the dashboard origin is allowed'],
  ['100 anonymous requests in one minute','83 allowed, 17 answered 429'],
  ['Response headers over the public tunnel','Present: no-store, strict transport, sealed content policy']],
  [CW*0.6,CW*0.4]),
 Spacer(1,8),
 P('Still needed before real customers','h2')]
for t in ['<b>Needs you:</b> a permanent server with HTTPS and a firewall that exposes only that web port; the database and this PC\'s admin tools stay private.',
          '<b>Needs you:</b> live payment keys kept in the server\'s environment only, then one real refund test; rotate the beta password and bootstrap owner account.',
          '<b>Needs you:</b> email and OTP provider keys, Firebase and Apple push keys. None are connected, so those paths are untested live.',
          '<b>Next:</b> nightly encrypted database backups with a tested restore; an alert on repeated 429 or 401 bursts; an independent penetration test before public launch.',
          '<b>Privacy:</b> the app stores phone, address and order history. Publish a privacy policy, and add an account-deletion route (stores require it).',
          '<b>Next:</b> replace the quick tunnel with a named one; quick tunnels are for testing and the address changes on restart.']:
    s.append(B(t))
s += [Spacer(1,8),P('Not covered: compiled iOS and Android binaries, the Cloudflare account, the Codemagic and Apple accounts, the Windows PC itself, and any live third-party service.','small')]
doc.build(s)
print(OUT)
