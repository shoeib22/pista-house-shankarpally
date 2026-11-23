from pathlib import Path
from docx import Document
from docx.shared import Pt, Mm
from docx.enum.text import WD_ALIGN_PARAGRAPH

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/Pista_House_Software_Development_Agreement_DRAFT.docx'
OUT.parent.mkdir(parents=True, exist_ok=True)

d = Document()
sec = d.sections[0]
sec.page_width, sec.page_height = Mm(210), Mm(297)
for m in ('left_margin', 'right_margin'):
    setattr(sec, m, Mm(25))
st = d.styles['Normal']
st.font.name = 'Calibri'
st.font.size = Pt(11)

def title(t):
    p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = p.add_run(t); r.bold = True; r.font.size = Pt(16)

def h(t):
    p = d.add_paragraph(); p.paragraph_format.space_before = Pt(12)
    r = p.add_run(t); r.bold = True; r.font.size = Pt(12)

def para(t, indent=0):
    p = d.add_paragraph(t); p.paragraph_format.left_indent = Mm(indent)
    p.paragraph_format.space_after = Pt(4)
    return p

n = [0]
def clause(sec_no, t):
    para(f'{sec_no}  {t}', 0)

title('SOFTWARE DEVELOPMENT AGREEMENT')
p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
r = p.add_run('DRAFT for discussion. Not legal advice. Have a lawyer review before signing. '
              'Items in [square brackets] must be filled in.'); r.italic = True; r.font.size = Pt(9)

para('This Software Development Agreement (the "Agreement") is made on [DATE] at [CITY], Telangana, India, between:')
para('(1) [CLIENT LEGAL NAME], [a proprietorship / partnership / company incorporated under the Companies Act, 2013], '
     'operating as "Pista House Shankarpally", having its place of business at [ADDRESS] (the "Client"); and')
para('(2) [DEVELOPER FULL NAME], [individual / proprietor], residing at [ADDRESS], PAN [PAN] (the "Developer").')
para('The Client and the Developer are each a "Party" and together the "Parties".')

h('1. Background')
para('The Client runs a restaurant and delivery business. The Client wishes to engage the Developer to design, build, deploy and '
     'support a food ordering and delivery platform, and the Developer agrees to do so on the terms below.')

h('2. Services and deliverables')
clause('2.1', 'The Developer will deliver the following (together the "Platform"): (a) a customer mobile app (iOS); (b) an owner mobile app (iOS); '
       '(c) a delivery-partner mobile app (iOS); (d) a staff web dashboard; and (e) a backend server and database, as described in the '
       'feature list in Schedule A.')
clause('2.2', 'Scope is limited to Schedule A. Anything not listed (including, unless added in writing, Android apps, a POS integration, '
       'marketing websites, recommendation engines, SMS/WhatsApp messaging and content creation) is out of scope and may be added by a '
       'written change request under clause 4.')
clause('2.3', 'The Developer will use reasonable skill and care, follow good industry practice, and keep the source code in a version-controlled repository.')

h('3. Timeline and acceptance')
clause('3.1', 'The milestones and target dates are in Schedule B. Dates are targets and depend on the Client supplying inputs on time '
       '(menu, prices, branding, third-party account access, approvals) within [3] business days of request.')
clause('3.2', 'On delivery of each milestone the Client has [7] days to test and either accept it or give written, specific reasons for '
       'rejection. The Developer will correct genuine defects against Schedule A within [10] days. A milestone is deemed accepted if the Client '
       'does not respond within the review period or uses it in live operation.')
clause('3.3', 'Defects are failures to meet Schedule A. Differences of preference or new requirements are change requests, not defects.')

h('4. Change requests')
para('Either Party may request a change in writing (message or email is enough). The Developer will state the effect on price and timeline, '
     'and the change takes effect only when the Client approves it in writing.')

h('5. Fees and payment')
clause('5.1', 'Total fee: INR [AMOUNT] (in words: [AMOUNT IN WORDS]), exclusive of applicable taxes, payable as set out in Schedule C.')
clause('5.2', 'Unless Schedule C says otherwise: [30]% advance on signing; [__]% on acceptance of each milestone; balance on go-live.')
clause('5.3', 'Invoices are payable within [7] days. Late amounts carry interest at [1.5]% per month. The Developer may pause work while an undisputed '
       'invoice is overdue by more than [10] days.')
clause('5.4', 'GST and other taxes are payable by the Client where applicable; the Client may deduct TDS as required by law and will provide the certificate.')
clause('5.5', 'Third-party costs are paid by the Client directly in the Client’s own name and are not included in the fee. These include: hosting and domain, '
       'Apple Developer Program, Google Firebase, payment-gateway fees, email/SMS providers, map services, and CI/build services.')

h('6. Accounts, credentials and third-party services')
clause('6.1', 'The Client will own and hold the accounts for hosting, domain, app stores, payment gateway, push notifications and similar services, '
       'and will give the Developer the access needed to do the work. Access may be withdrawn at the end of the engagement.')
clause('6.2', 'Each Party will keep credentials, API keys and secrets confidential, use them only for the Platform, and not commit them to source control '
       'or share them in chat.')
clause('6.3', 'The Client is responsible for the terms, fees, availability and approvals of third-party services (including app-store review). '
       'The Developer is not liable for outages, changes or refusals by those providers.')

h('7. Intellectual property')
clause('7.1', 'On payment in full, the Client owns the custom source code, designs and content created specifically for the Platform ("Deliverables"). '
       'Until then the Developer grants the Client a limited licence to use the Deliverables for testing.')
clause('7.2', 'The Developer keeps ownership of pre-existing tools, libraries, templates and know-how, and of general skills and techniques '
       '("Developer Tools"), and grants the Client a perpetual, non-exclusive, royalty-free licence to use them as part of the Platform.')
clause('7.3', 'Open-source and third-party components remain under their own licences. The Developer will list the significant ones on request.')
clause('7.4', 'The Client owns its brand, name, logo, menu content, photographs and customer data, and grants the Developer a licence to use them solely to build and support the Platform.')
clause('7.5', 'The Developer may mention the project in a portfolio, without disclosing Confidential Information, unless the Client objects in writing.')

h('8. Data protection and privacy')
clause('8.1', 'The Client is the data fiduciary for customer and staff personal data processed by the Platform; the Developer acts as a processor '
       'on the Client’s instructions, in line with the Digital Personal Data Protection Act, 2023 and other applicable Indian law.')
clause('8.2', 'The Developer will apply reasonable security measures (including access control, hashed passwords, encrypted connections and limited-purpose '
       'access), and will tell the Client without undue delay on becoming aware of a data breach affecting the Platform.')
clause('8.3', 'The Client is responsible for the privacy policy, user consents (including consent for promotional messages), lawful retention periods, '
       'and responding to user requests. The Developer will provide the technical means described in Schedule A.')
clause('8.4', 'The Developer will access live customer data only when needed to provide support and will not copy or use it for any other purpose.')

h('9. Confidentiality')
para('Each Party will keep the other’s non-public business, technical and financial information confidential, use it only for this Agreement, and '
     'disclose it only to people who need it and are bound to the same duty, or where the law requires. This survives for [3] years after the Agreement ends. '
     'It does not cover information that is public, already known, independently developed or lawfully received from someone else.')

h('10. Warranties and disclaimers')
clause('10.1', 'The Developer warrants that the Deliverables will substantially conform to Schedule A at acceptance, that the Developer has the right to '
       'enter this Agreement, and that, to the Developer’s knowledge, the Deliverables do not knowingly infringe anyone’s rights.')
clause('10.2', 'The Developer will correct defects reported within [90] days of go-live at no charge ("Warranty Period"). This does not cover problems '
       'caused by changes made by others, misuse, third-party services or hardware, or new requirements.')
clause('10.3', 'Except as stated, the Platform is provided "as is". The Developer does not promise uninterrupted or error-free operation, '
       'approval by app stores, or any particular sales, order volume or business result.')
clause('10.4', 'The Client acknowledges that payment, delivery, tax, food-safety, labour and consumer laws apply to the Client’s business and are the Client’s responsibility.')

h('11. Support and maintenance')
para('After the Warranty Period, support and hosting management are available under a separate monthly plan: INR [AMOUNT] per month covering [scope, response times, '
     'hours]. Without such a plan, work is charged at INR [RATE] per hour on request.')

h('12. Limitation of liability')
clause('12.1', 'Neither Party is liable for indirect or consequential loss, loss of profit, revenue, goodwill or data, to the extent the law allows.')
clause('12.2', 'The Developer’s total liability under this Agreement is capped at the fees actually paid by the Client in the [12] months before the claim.')
clause('12.3', 'Nothing limits liability for fraud, wilful misconduct, breach of confidentiality, or anything that cannot be limited by law.')

h('13. Indemnity')
para('The Client will indemnify the Developer against third-party claims arising from the Client’s content, business operations, or use of the Platform '
     'in breach of law or this Agreement. The Developer will indemnify the Client against third-party claims that the Developer-written code, used as '
     'delivered, infringes that third party’s Indian intellectual-property rights, subject to clause 12.')

h('14. Term and termination')
clause('14.1', 'This Agreement starts on the date above and continues until the Platform is delivered and accepted, unless ended earlier under this clause.')
clause('14.2', 'Either Party may terminate on [15] days’ written notice if the other materially breaches and does not fix the breach within that period.')
clause('14.3', 'The Client may terminate for convenience on [15] days’ notice. The Client will pay for work done up to termination, '
       'and non-refundable third-party costs committed.')
clause('14.4', 'On termination, the Developer will hand over the work completed so far (subject to payment under clause 7.1), '
       'and each Party will return or delete the other’s confidential information.')
clause('14.5', 'Clauses 7, 8, 9, 12, 13, 15 and 16 survive termination.')

h('15. Relationship')
para('The Developer is an independent contractor, not an employee, partner or agent of the Client, controls how the work is done, and is responsible for '
     'their own taxes, equipment and insurance. The Developer may take other work provided it does not breach clause 9.')

h('16. Governing law and disputes')
clause('16.1', 'This Agreement is governed by the laws of India.')
clause('16.2', 'The Parties will first try to settle any dispute by discussion within [30] days of written notice. If unresolved, it will be referred to '
       'a sole arbitrator appointed by mutual agreement under the Arbitration and Conciliation Act, 1996. The seat is [Hyderabad], the language English.')
clause('16.3', 'Subject to that, courts at [Hyderabad], Telangana have exclusive jurisdiction.')

h('17. General')
para('Entire agreement: this Agreement and its Schedules replace earlier discussions on this subject. Amendments must be in writing and signed (or confirmed by email by both Parties). '
     'Assignment: neither Party may assign without the other’s written consent. Notices: in writing to the addresses above, or by email to [CLIENT EMAIL] and [DEVELOPER EMAIL]. '
     'Force majeure: neither Party is liable for delay caused by events beyond reasonable control. Severability: if a clause is invalid the rest continues. '
     'Waiver: failing to enforce a right is not giving it up. Counterparts and e-signatures are valid. Stamp duty on this Agreement is borne by [the Client].')

para('')
para('Signed by the Parties on the date first written above.')
t = d.add_table(rows=4, cols=2)
t.cell(0, 0).text = 'For the Client'; t.cell(0, 1).text = 'The Developer'
t.cell(1, 0).text = '\n\nSignature: ______________________'; t.cell(1, 1).text = '\n\nSignature: ______________________'
t.cell(2, 0).text = 'Name: [NAME]'; t.cell(2, 1).text = 'Name: [NAME]'
t.cell(3, 0).text = 'Title: [TITLE]   Date: __________'; t.cell(3, 1).text = 'Date: __________'
para('Witness 1: ____________________      Witness 2: ____________________')

d.add_page_break()
h('Schedule A: Scope of the Platform')
para('Customer app (iOS): registration and login; email verification; menu browsing; cart; checkout with pickup or delivery; saved addresses with a map pin picker; '
     'payment page; order history and reorder; live order tracking with ETA; help and support requests with up to three photos; in-app notification inbox and opt-in settings.')
para('Owner app (iOS): order management and status changes; menu and availability; auto-dispatch settings; live rider and order map; refund screen; support inbox with replies and private notes; notification inbox.')
para('Delivery app (iOS): rider sign-in; delivery offers and acceptance; route map to the customer; location sharing during an active delivery; delivery verification; notification inbox.')
para('Staff dashboard (web): orders, kitchen view, delivery desk, menu, shift log, team and access management, support desk.')
para('Backend: APIs, database, authentication and roles, payment-gateway integration (simulated until live gateway credentials are supplied), notification engine with push-ready adapter, '
     'support system with photo attachments, automated tests, and documentation.')
para('Not included unless added by change request: Android apps; live payment-gateway activation; Firebase/Apple push configuration; POS integration; SMS/WhatsApp; '
     'recommendation or discount engines; public App Store submission and listing text; legal policies; hosting set-up beyond [describe].')

h('Schedule B: Milestones')
tb = d.add_table(rows=1, cols=3); tb.style = 'Table Grid'
for i, x in enumerate(['Milestone', 'Description', 'Target date']): tb.rows[0].cells[i].text = x
for row in [['M1', 'Core ordering, accounts and dashboard', '[DATE]'], ['M2', 'Tracking, dispatch, rider app', '[DATE]'],
            ['M3', 'Payments, refunds, support, notifications', '[DATE]'], ['M4', 'Live set-up (hosting, gateway, push) and pilot', '[DATE]'],
            ['M5', 'Store submission support and go-live', '[DATE]']]:
    c = tb.add_row().cells
    for i, x in enumerate(row): c[i].text = x

h('Schedule C: Fees and payment plan')
tc = d.add_table(rows=1, cols=3); tc.style = 'Table Grid'
for i, x in enumerate(['Payment', 'Trigger', 'Amount (INR)']): tc.rows[0].cells[i].text = x
for row in [['Advance', 'On signing', '[AMOUNT]'], ['Milestone payment', 'On acceptance of M2', '[AMOUNT]'],
            ['Milestone payment', 'On acceptance of M3', '[AMOUNT]'], ['Balance', 'On go-live (M5)', '[AMOUNT]']]:
    c = tc.add_row().cells
    for i, x in enumerate(row): c[i].text = x
para('')
para('Monthly support plan (optional): INR [AMOUNT] per month, starting [DATE].')

d.save(OUT)
print(OUT)
