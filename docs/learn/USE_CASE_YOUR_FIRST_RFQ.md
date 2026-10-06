# Your first RFQ, step by step

In this exercise **you are the supplier**. You take one RFQ from the moment it
arrives until the money is in the bank and the file is closed. At every step
you get three things:

- **In the market**: what really happens between the companies.
- **In the app**: what you click, and what the system does for you.
- **Words to know**: the terms people in the trade use, so you understand
  them in emails and meetings and can use them yourself.

It takes about an hour. Read [section 1 of the tutorial](TUTORIAL_RFQ_TO_CLOSURE.md#1-the-job-that-started-this)
first. It explains the supply chain, margin and why customers use a supplier
at all.

> Every company, person, part number and price here is **fictional**,
> made up for training. The real part is the way the work flows and the words
> people use.

---

## The story

| Role | Name (fictional) | Who they are |
|---|---|---|
| **You** | Crescent Aero Supplies LLC, Abu Dhabi | An aircraft-parts **supplier** (trader). You are the procurement coordinator. |
| **End customer** | Al Noor Aviation Maintenance LLC | An **MRO** (maintenance shop) that services C-130H Hercules aircraft |
| **Vendor 1** | Hydra Parts Distribution FZE, Dubai | The **authorized distributor** for the pump's manufacturer |
| **Vendor 2** | Atlas Surplus Aviation, Miami | A **broker** with overhauled pumps in stock |
| **Manufacturer** | Hydraflow Systems | The **OEM**. It sells only through distributors, so you don't contact it. |

**The document:** [`samples/ANM-RFQ-2026-0147.docx`](samples/ANM-RFQ-2026-0147.docx),
a one-item RFQ for two engine-driven hydraulic pumps.

**The timeline:**

| Day | What happens |
|---|---|
| 1 | RFQ arrives. You check it, decide to bid, and ask two vendors for prices. |
| 3–5 | Vendor quotes come back. |
| 6 | You send your quotation to the customer. |
| 20 | The customer sends you a purchase order. You order from the vendor. |
| 22–29 | The parts are shipped to you. |
| 30 | You inspect the parts and deliver them. |
| 31 | You invoice the customer. |
| 91 | The customer pays. You close the file. |

**Before you start:** start the app (see the [README](../../README.md#quick-start))
and open <http://localhost:3000>. You'll work in the **Defense / Aviation
Procurement** project. Its fields are the ones the real job asked for: RFQ
number, platform, part numbers, description, quantity, UOM, condition,
deadline, technical notes, plus buyer, contact email and delivery place.

---

## Step 1 · Day 1, 09:10: the RFQ arrives

### In the market

An email arrives from the customer:

> **Subject:** RFQ ANM-RFQ-2026-0147 – Hydraulic pump, C-130H – closing 06 Oct 2026
>
> Dear Supplier,
> Please find attached our RFQ. Kindly quote your best price and lead time
> before the closing date.
> Regards, Procurement Department, Al Noor Aviation Maintenance

Open the attachment and read it the way a buyer does. Every RFQ has the same
parts:

| In the document | What it tells you |
|---|---|
| **RFQ No.** ANM-RFQ-2026-0147 | The customer's reference. Quote it in every reply to them. |
| **Closing date** 06 Oct 2026, 14:00 GST | Your quotation must arrive before this. Late quotes are usually ignored. |
| **Platform** C-130H Hercules | The aircraft the part is for. Vendors ask for it. |
| **Priority** Routine (not AOG) | No emergency. You have time to compare vendors. |
| **Line item** 1 | One row of what they want. Big RFQs have 50+ lines. |
| **P/N** HP-4471-02 | The manufacturer's part number: *exactly* what they want. |
| **NSN** 1650-01-555-0147 | NATO Stock Number, the military's own ID for the same item |
| **Qty / UOM** 2 EA | Two pieces (EA = each) |
| **Condition** NE or OH | New, or overhauled. Both are acceptable. |
| **Requirements** | The rules your offer must meet: certificates, delivery terms, payment, validity |

### In the app

1. Open **Defense / Aviation Procurement**.
2. Drag the `.docx` onto the project page. (To look first without saving
   anything, use **Test a file** instead.)
3. The system reads the Word file, decides it's an RFQ (**triage**), and
   **extracts** the fields. When I ran this file, it filled **all 12 fields
   in about 30 seconds**, each with the passage it came from.

**What the app just did for you:** in a normal office, someone saves the
attachment, opens it, and retypes RFQ number, part number, quantity and
deadline into a spreadsheet. That's the job the system replaces.

### Words to know

- **RFQ**: Request for Quotation. "Give me a price."
- **Closing date / due date**: the deadline for your quote.
- **Line item**: one row (one part) in an RFQ or order.
- **P/N**: part number. **NSN**: NATO Stock Number.
- **UOM**: unit of measure (EA each, SET, KIT, FT).
- **Platform**: the aircraft or vehicle the part fits.
- **Condition codes**: **NE** new, **NS** new surplus (new but old stock),
  **OH** overhauled, **SV** serviceable (tested, working), **AR** as removed
  (untested, taken off an aircraft).
- **AOG**: aircraft on ground. An aircraft can't fly until the part arrives.
  The opposite of routine; urgent and expensive.

---

## Step 2 · Day 1, 09:15: check what the machine read

### In the market

One wrong digit in a part number means you buy the wrong part and eat the
cost. That's why somebody always checks the typed values against the
document.

### In the app

Open the document from the queue. The original is on the left, the fields
on the right.

1. Click each field. The page jumps to where the value was found and
   highlights it. Check that they match.
2. Pay extra attention to these:

   | Field | Check | Why it matters |
   |---|---|---|
   | Part numbers | Every character, including the dash number (-02) | -02 and -03 can be different parts, or one can replace the other |
   | Quantity + UOM | 2 EA, not 2 SET | You'd quote the wrong amount |
   | Condition | NE or OH | It decides which vendors can offer |
   | Deadline | 2026-10-06 | Miss it and the work is wasted |

3. **Exercise:** the RFQ says *alternate part number HP-4471-03
   (superseding) is acceptable*. You want vendors to quote either number,
   so both must be in **Part numbers**. The project's field meaning (in
   **Settings → Fields to extract**, the line under each field) tells the
   AI to include acceptable alternates, and it usually does: expect
   `HP-4471-02`, the NSN `1650-01-555-0147` and `HP-4471-03`. If `-03` is
   only in **Technical notes**, add it on a new line in **Part numbers** and
   press **Ctrl+S**. Catching this is exactly what the review step is for.
4. Press **Ctrl+Enter** (Approve & next).
5. On the project page, **Export Excel** gives you the approved RFQs as one
   sheet. In an office this sheet is called the **RFQ register** or **RFQ
   log**: every RFQ received, its status and its deadline.

### Words to know

- **Alternate P/N**: a different part number the customer also accepts.
- **Superseded / superseding**: the manufacturer replaced an old P/N (-02)
  with a new one (-03). The new one *supersedes* the old one.
- **Interchangeable**: fits and works in place of the other part without
  changes.
- **Release certificate**: the document that says a part is airworthy:
  **FAA 8130-3** (USA) or **EASA Form 1** (Europe). "Dual release" means both.
- **CoC**: Certificate of Conformity. The seller's statement that the part
  meets the order.
- **Traceability / trace**: the paper trail showing where the part came
  from. No trace, no sale in aviation.
- **Tear-down report**: the repair shop's report of what it found and fixed
  when it overhauled the part.
- **Approved repair station**: a workshop licensed to overhaul parts (in
  the trade: **Part 145** repair station, after the FAA and EASA rules).
- **Incoterms**: standard rules for who pays for shipping and when the risk
  moves. This RFQ asks for **DAP Abu Dhabi**: you deliver to their door,
  they handle import duties.
- **Payment terms**: *60 days from invoice* means they pay you 60 days after
  they receive your invoice. Written "Net 60".
- **Validity**: how long your price stays good. They ask for at least 30
  days.

---

## Step 3 · Day 1, 10:00: bid or no-bid

### In the market

Before spending time on it, decide whether to quote at all. Ask:

- **Can we get it?** Is the part available: new from the factory, or
  overhauled from the market?
- **Can we meet the terms?** 45 days delivery, certificates, DAP Abu Dhabi.
- **Is there export control?** Some military parts need an export licence
  from the US or EU. That adds weeks and paperwork.
- **Is the customer good?** Do they pay on time? Have we worked with them?
- **Is it worth it?** Two pumps are a decent order. A 20-dollar washer might
  not be worth the paperwork.

Your answer: yes to all. **You bid.**

If the answer were no, you would still reply, politely:
*"Thank you for your RFQ ANM-RFQ-2026-0147. We regret we are unable to quote
on this occasion."* This is called **sending a regret**. It keeps you on the
customer's list for the next RFQ.

### In the app

The bid/no-bid decision isn't recorded in the app yet (see the tutorial's
[section 7](TUTORIAL_RFQ_TO_CLOSURE.md#7-whats-next-the-gaps-between-this-and-the-full-job)).
You make it in your head, or in the RFQ register.

### Words to know

- **Bid / no-bid**: the decision to quote or not.
- **Regret**: a polite "we can't quote this".
- **Compliant offer**: an offer that meets every requirement in the RFQ.
  **Non-compliant** offers are often rejected without being read.
- **Export control, export licence**: government permission to export
  certain military or dual-use parts (US: ITAR, EAR).
- **EUC**: end-user certificate, the buyer's signed statement of who will
  use the part and where. Often needed with export licences.

---

## Step 4 · Day 1, 10:05: open a procurement task

### In the market

Once you decide to bid, the RFQ becomes a live job. Offices call it
*opening a job*, *opening a file* or *opening an enquiry*, and give it an
internal reference number.

### In the app

On the approved document, click **Create procurement task**. The task page
opens with a stepper: **Sourcing → Ordered → Shipped → Delivered → Invoiced →
Closed**. The extracted RFQ details sit at the top, and every action from now
on is recorded on the **Event timeline**.

### Words to know

- **Job / file / enquiry**: one RFQ you're actively working on.
- **Internal reference**: your own number for the job, used with vendors
  instead of the customer's number.

---

## Step 5 · Day 1, 10:15: ask the vendors (sourcing)

### In the market

Now you do the same RFQ work one level up: you ask vendors for prices.

**Who to ask:**

- The **authorized distributor** (Hydra Parts). New parts, full factory
  paperwork, reliable. May need to order from the factory, which takes time.
- A **broker** (Atlas Surplus). Surplus and overhauled parts, often in stock,
  cheaper. Check the paperwork carefully.
- Not the **manufacturer**: Hydraflow only sells through its distributors.

Ask at least two vendors, and usually three to five. Competition gets you a
better price, and if one vendor fails you have a backup.

**Never tell a vendor who your customer is.** Use your own reference, not
the customer's RFQ number, and don't forward the customer's document. A vendor
who knows your customer can quote them directly and cut you out.

**A good vendor RFQ asks for everything you need to build your quote:**

- P/N, **and alternates** (HP-4471-02 or -03)
- Quantity and UOM (2 EA)
- Acceptable conditions (NE or OH)
- Required certificates (8130-3 or EASA Form 1, CoC, tear-down report for OH)
- Price per unit, **lead time**, **validity**, payment terms
- Their Incoterm and shipping point, weight and dimensions (so you can price
  freight)
- **A reply deadline earlier than the customer's.** You need time to compare
  and build your own quote. If the customer closes on 6 Oct, ask vendors to
  reply by about 2 Oct.

### In the app

1. Open **Vendors** in the sidebar and add both:
   - *Hydra Parts Distribution FZE*, `sales@hydraparts.example`, notes:
     *Authorized distributor, Hydraflow*
   - *Atlas Surplus Aviation*, `quotes@atlas-surplus.example`, notes:
     *Broker, OH stock, USA*
2. Back on the task, under **Invite a vendor**, choose each one and click
   **Invite**.
3. On each vendor's row, click **Draft RFQ email**. The local AI writes the
   request from the extracted fields. Check two things:
   - it uses **your task's reference** (*RFQ-T…*), not ANM-RFQ-2026-0147;
   - it does **not** name Al Noor or give their email.
4. Edit the draft if needed, add the reply deadline, and send it from your
   own mailbox. The app never sends email itself.

### Words to know

- **Sourcing**: finding who can supply the part, and at what price.
- **Availability**: whether they have it and how fast they can deliver it.
- **Ex-stock / in stock**: they have it on the shelf now.
- **Factory lead time**: how long the manufacturer takes to make it.
- **Lead time**: days from your order to delivery. Written "30 days
  **ARO**" (after receipt of order).
- **MOQ**: minimum order quantity.
- **Back-to-back**: your order to the vendor mirrors the customer's order to
  you: same part, quantity, condition and certificates.

---

## Step 6 · Day 3 to 5: the vendor quotes come back

### In the market

Two replies arrive:

> **Hydra Parts Distribution:** HP-4471-03 (supersedes -02), condition NE,
> **USD 21,000.00/EA**, lead time **30 days ARO**, **FCA Dubai**, FAA 8130-3
> and EASA Form 1 (dual release). Quote valid 30 days. Payment net 30.

> **Atlas Surplus Aviation:** HP-4471-02, condition OH, **USD 14,500.00/EA**,
> qty 2 **ex-stock**, **EXW Miami**, 8130-3 from Part 145 repair station,
> tear-down reports attached. Quote valid **15 days**, **subject to prior
> sale**. Payment **100% in advance** by TT.

They look very different. Line them up **apples to apples** in a
comparison table (people call this a **bid tab** or **quote comparison**):

| | Hydra (distributor) | Atlas (broker) |
|---|---|---|
| Part number | HP-4471-03 (the newer P/N) | HP-4471-02 (the requested P/N) |
| Condition | NE (new) | OH (overhauled) |
| Unit price | 21,000 | 14,500 |
| Where you collect it | FCA Dubai: they hand it to your carrier in Dubai | EXW Miami: you collect it from their warehouse in the USA |
| Freight to Abu Dhabi | cheap (a truck) | expensive (air freight + insurance) |
| Lead time | 30 days | in stock now |
| Validity | 30 days | 15 days, and it may be sold to someone else |
| Payment | 30 days after invoice | in advance |

The unit price alone is misleading. You compare **landed cost**: price +
freight + everything else to get the part to you. You'll work it out in
step 7.

### In the app

In each vendor's row under **Quotes**, fill in:

- **Price**: the unit price (21000 and 14500),
- **Lead time (days)**: 30 and 5 (Atlas: in stock, a few days to ship),
- **Notes**: the rest, for example *NE, P/N -03, FCA Dubai, dual release,
  valid 30d, net 30* and *OH, P/N -02, EXW Miami, TDR, valid 15d, subject to
  prior sale, 100% advance*,

then click **Log quote**. Don't click **Select as winner** yet: you
choose a vendor only after the customer orders from you (step 8).

### Words to know

- **Bid tab / quote comparison**: the side-by-side table above.
- **Apples to apples**: comparing like with like after adjusting for
  condition, freight and terms.
- **EXW** (ex works): you collect from their door and pay all freight.
- **FCA** (free carrier): they hand the goods to your carrier at a named
  place.
- **DAP** (delivered at place): the seller delivers to the buyer's door; the
  buyer pays import duties.
- **DDP** (delivered duty paid): like DAP, but the seller pays duties too.
- **Subject to prior sale**: "someone else may buy it first". Common with
  brokers.
- **TT**: telegraphic transfer, i.e. a bank transfer.
- **Net 30**: pay within 30 days of the invoice.

---

## Step 7 · Day 6: work out your price and send your quotation

### In the market

**Landed cost** for each option (all USD, two pumps):

| | Option A: NE from Hydra | Option B: OH from Atlas |
|---|---:|---:|
| Vendor price, 2 × unit | 42,000 | 29,000 |
| Freight to Abu Dhabi + insurance | 300 (truck from Dubai) | 1,200 (air from Miami) |
| Bank charges, customs clearance, handling | 200 | 300 |
| **Landed cost** | **42,500** | **30,500** |

**Choose a margin** for each option. Option B carries more risk: a broker,
overhauled parts, payment in advance, a short validity. So you ask a little
more for it:

| | Option A | Option B |
|---|---:|---:|
| Target margin | 12% | 15% |
| Price = landed cost ÷ (1 − margin) | 42,500 ÷ 0.88 = 48,295 | 30,500 ÷ 0.85 = 35,882 |
| **Your price (rounded)** | **48,300** (24,150/EA) | **35,900** (17,950/EA) |
| Your profit | 5,800 | 5,400 |

Remember: `42,500 × 1.12` would give 47,600, a 10.7% margin, not 12%. See
[margin vs markup](TUTORIAL_RFQ_TO_CLOSURE.md#margin-markup-and-commission-three-different-words).

**Your lead time to the customer** = vendor lead time + shipping +
inspection + a small buffer:

- Option A: 30 days + about 2 days trucking + 3 days inspection and buffer
  = **35 days ARO**
- Option B: about 3 days to ship + 7 days air freight and customs + 5 days
  inspection and buffer = **15 days ARO**

**The validity trap.** The customer wants your prices valid for 30 days, but
Atlas's price is only good for 15 days and the stock could sell. Never
promise a customer more than your vendor promised you. Write *Option B:
subject to prior sale* in your quotation, or ask Atlas to hold the stock.

Your quotation (this one goes **to the customer**, so now you *do* use their
RFQ number):

> **Quotation CAS-Q-2026-0312** · Your ref: ANM-RFQ-2026-0147
>
> | Option | P/N | Condition | Qty | Unit price | Total | Lead time |
> |---|---|---|---|---:|---:|---|
> | A | HP-4471-03 (supersedes -02) | NE | 2 EA | 24,150.00 | 48,300.00 | 35 days ARO |
> | B | HP-4471-02 | OH | 2 EA | 17,950.00 | 35,900.00 | 15 days ARO |
>
> Prices in USD, **DAP Abu Dhabi** (Incoterms 2020). Certificates: FAA 8130-3
> (A: dual release with EASA Form 1), CoC; OH units with tear-down report.
> Payment: 60 days from invoice. **Validity: 30 days; Option B subject to
> prior sale.**

Send it well before the closing date. Offering two options is common: it
lets the customer choose between cheaper and newer.

### In the app

Not built yet. The app has no margin calculator or customer quotation
(tutorial [section 7](TUTORIAL_RFQ_TO_CLOSURE.md#7-whats-next-the-gaps-between-this-and-the-full-job),
item 2). Do this in Excel, using the Excel export and the quotes you logged.

### Words to know

- **Quotation / quote / offer**: your price to the customer.
- **Our ref / your ref**: your quotation number / their RFQ number.
- **Landed cost**: everything you pay to get the part to you.
- **Margin**: profit ÷ selling price. **Markup**: profit ÷ cost.
- **Options**: two or more alternatives in one quotation.
- **Firm price**: a price that won't change during the validity period.
- USD and AED: the UAE dirham is pegged to the dollar (1 USD = 3.6725 AED), so
  many Gulf quotes are in USD.

---

## Step 8 · Day 20: you win the order

### In the market

The customer sends you a **purchase order (PO)**: *ANM-PO-2026-0588, Option
B, 2 EA HP-4471-02 OH, USD 35,900, DAP Abu Dhabi, 15 days, net 60.* You won.

Now, in this order:

1. **Check the PO against your quotation**: P/N, condition, quantity, price,
   Incoterm, lead time, payment terms. Mistakes happen on both sides, so
   catch them now.
2. **Acknowledge the PO.** Reply *"We acknowledge receipt of your PO
   ANM-PO-2026-0588 and confirm delivery within 15 days."* This is a **PO
   acknowledgement** or **order confirmation**.
3. **Reconfirm with the vendor.** Atlas's quote was valid for 15 days, and it's
   now day 20. Ask: *"Please reconfirm price and availability."* Atlas
   confirms that both pumps are still available at the same price.
4. **Place your PO with Atlas**: *CAS-PO-2026-0144*, back-to-back with the
   customer's order: same P/N, condition, quantity and certificates.
5. Atlas sends a **proforma invoice** (an invoice issued *before* delivery so
   you can pay in advance). You pay USD 29,000 by TT.

**Look at the cash.** You pay Atlas on day 21. The customer pays you around
day 91. For 70 days, **your** money carries this order. That's one of the
things your margin pays for, and one reason the customer doesn't buy from
Atlas directly.

If you had **lost**, you would politely ask for feedback ("Could you share
where our price stood?") and note the winning price for next time.

### In the app

On the task, under **Quotes**: first update Atlas's **Notes** (*reconfirmed
day 20; our PO CAS-PO-2026-0144; prepaid TT*) and click **Log quote**. Then
click **Select as winner** on Atlas. The task moves to **Ordered**, and quotes
are locked from here on.

### Words to know

- **Award**: the customer chooses your offer.
- **PO**: purchase order, a binding order to buy.
- **PO acknowledgement / order confirmation**: your written "yes, we accept
  this order".
- **Reconfirm**: ask the vendor to check that an expired quote still holds.
- **Proforma invoice**: an invoice sent before delivery, usually for advance
  payment.
- **L1**: the lowest bidder (used in the Gulf and South Asia). US
  government: **LPTA**, lowest price technically acceptable.
- **Debrief**: feedback from the customer on why you lost or won.

---

## Step 9 · Day 22 to 29: shipping

### In the market

Your **freight forwarder** collects the pumps at Atlas in Miami (EXW, so it's
your job) and flies them to Abu Dhabi. The shipment travels with:

- **Commercial invoice**: the vendor's invoice for customs,
- **Packing list**: what is in each box, with weights,
- **AWB** (air waybill): the airline's receipt and tracking number,
- the **certificates** (8130-3, tear-down reports), which travel with the
  parts.

In Abu Dhabi, the forwarder **clears customs** using the part's **HS code**
(the customs classification).

### In the app

Click **Mark shipped** on the task. You can put the AWB number in the
invoice note later so it's on file.

### Words to know

- **Freight forwarder**: the company that arranges transport and customs.
- **AWB**: air waybill. For sea freight it's a **B/L** (bill of lading).
- **HS code**: the customs code for a type of goods.
- **Customs clearance**: getting goods released by customs.
- **Tracking**: following the shipment with the AWB number.

---

## Step 10 · Day 30: receive, inspect, deliver

### In the market

Before anything goes to the customer, you do **receiving inspection**:

- Does the P/N on the part match the order (-02)?
- Does the **serial number (S/N)** on each pump match its 8130-3?
- Are the tear-down reports there, one per pump?
- Is there any damage? Are the ports capped and the packaging intact?

If the paperwork doesn't match, the part goes into **quarantine** (put aside,
not delivered) until the vendor fixes it. Delivering a part with bad
paperwork can ground an aircraft and lose you the customer.

All good? Deliver to Al Noor with your **delivery note**. They sign it, which
is your **proof of delivery (POD)**. On their side, they record a **GRN**
(goods received note).

### In the app

Click **Mark delivered**.

### Words to know

- **Receiving inspection / goods-in inspection**: checking parts and
  paperwork on arrival.
- **S/N**: serial number, unique to one physical part.
- **Quarantine**: parts held back until a problem is fixed.
- **Delivery note / POD**: the signed paper proving delivery.
- **GRN**: goods received note, the customer's internal record.

---

## Step 11 · Day 31: invoice

### In the market

Send the customer a **tax invoice**: your invoice number, their PO number,
the items, USD 35,900, and the due date (60 days: day 91). UAE VAT is 5%
where it applies, and some sales are zero-rated. Your accountant decides;
don't guess. The money the customer owes you is now your **accounts
receivable (AR)**.

### In the app

Under **Financial closure**, enter:

- **Invoice amount**: 35900
- **Note**: *INV CAS-INV-2026-0207 · PO ANM-PO-2026-0588 · net 60, due day 91 ·
  AWB 123-4567 8901*

Click **Log invoice**, then **Mark invoiced**.

### Words to know

- **Tax invoice**: the formal invoice, with VAT details.
- **Accounts receivable (AR)**: money customers owe you. The opposite is
  **accounts payable (AP)**: money you owe vendors.
- **Due date / overdue**: when payment is due, and when it's late.
- **Payment follow-up / dunning**: polite reminders to pay.

---

## Step 12 · Day 91: paid, and the file is closed

### In the market

The customer's payment arrives. Check the amount against the invoice (banks
sometimes deduct charges). Then check how you really did:

| | Quoted | Actual |
|---|---:|---:|
| Vendor price | 29,000 | 29,000 |
| Freight + insurance | 1,200 | **1,350** (fuel surcharge) |
| Clearance, bank, handling | 300 | 300 |
| **Landed cost** | 30,500 | **30,650** |
| Selling price | 35,900 | 35,900 |
| **Profit** | 5,400 (15.0%) | **5,250 (14.6%)** |

Freight came in a little higher, so you made slightly less than planned.
Watching quoted against actual on every job is how a supplier learns to
price better.

Finally, **archive** the file: RFQ, quotations, POs, certificates, invoices.
Aviation traceability records are kept for years.

### In the app

Click **Close task**. The **Event timeline** now shows the whole job:
created, vendors invited, emails drafted, quotes logged, winner selected,
shipped, delivered, invoiced, closed, each with a time. That's the audit
trail an email thread never gives you.

### Words to know

- **Reconciliation**: matching payments to invoices.
- **Quoted vs actual margin**: planned profit against real profit.
- **Job costing**: recording every real cost of a job.
- **File closure / archive**: finishing and storing the job's records.

---

## The whole order on one page

| Day | Step | Key words | Who | In the app |
|---|---|---|---|---|
| 1 | RFQ arrives | RFQ, line item, P/N, NSN, closing date | Sales | Drop file → auto-extracted |
| 1 | Check & log | trace, 8130-3, alternate P/N, RFQ register | You | Review screen → **Approve**, **Export Excel** |
| 1 | Bid / no-bid | regret, compliant, export licence | Bid manager | (not in app yet) |
| 1 | Open job | job number, internal reference | You | **Create procurement task** |
| 1 | Sourcing | vendor RFQ, availability, lead time | Procurement | **Vendors**, **Invite**, **Draft RFQ email** |
| 3–5 | Compare quotes | bid tab, landed cost, EXW/FCA, validity | Procurement | **Log quote** |
| 6 | Your quotation | margin, options, DAP, subject to prior sale | Bid manager | (Excel for now) |
| 20 | Award & order | PO, acknowledgement, reconfirm, proforma | Sales + procurement | **Select as winner** → Ordered |
| 22–29 | Ship | forwarder, AWB, HS code, clearance | Logistics | **Mark shipped** |
| 30 | Inspect & deliver | receiving inspection, S/N, quarantine, POD | Stores / QA | **Mark delivered** |
| 31 | Invoice | tax invoice, VAT, AR, net 60 | Finance | **Log invoice**, **Mark invoiced** |
| 91 | Paid & close | reconciliation, actual margin, archive | Finance | **Close task** |

---

## Try it again: three variations

Answer these yourself before reading the hints.

1. **It's AOG.** Same pump, but the customer writes *"AOG, required within
   48 hours"*. What changes?
   *Hint: speed beats price. Atlas's stock wins, next-flight air freight,
   you reply within hours rather than days, and a higher margin is normal
   for AOG service.*
2. **Nobody has stock.** The factory lead time is 120 days, and the customer
   wants 45. What do you send?
   *Hint: an honest quote with the real lead time, marked as a deviation
   from their requirement, or a regret. Never promise 45 days you can't
   deliver.*
3. **The customer pushes on price.** *"We found OH pumps in the market at
   15,000. Why are you at 17,950?"* How do you answer?
   *Hint: never name your vendor. Explain what's in your price: inspection,
   paperwork checked, freight and customs handled, delivery to their door,
   warranty, and 60 days' credit. Then decide whether you can move on
   margin.*

---

## Phrasebook: what people actually write

| Situation | Typical wording |
|---|---|
| Customer asks you | "Kindly quote your best price and lead time." · "Please treat as **AOG**." · "Quote per attached RFQ." |
| You ask a vendor | "Please quote your best price and availability for the following." · "Kindly advise condition, trace and lead time." · "Please quote **EXW/FCA** and advise weight and dimensions." · "Alternates acceptable." |
| Vendor answers | "**Ex-stock**, subject to prior sale." · "Lead time 30 days **ARO**." · "Quote valid 15 days." · "Payment 100% in advance." · "Dual release 8130-3 / EASA Form 1." |
| You to the customer | "Please find attached our quotation ref CAS-Q-2026-0312 against your RFQ ANM-RFQ-2026-0147." · "We **regret** we are unable to quote on this occasion." |
| After the order | "We acknowledge receipt of your PO." · "Please reconfirm price and availability." · "Please **expedite**." · "Goods are ready for collection." · "Please find the AWB and tracking details below." |
| Money | "Please find attached our proforma invoice for advance payment." · "Kindly arrange payment of the overdue invoice." |

For more terms, see the tutorial's
[glossary](TUTORIAL_RFQ_TO_CLOSURE.md#9-glossary).
