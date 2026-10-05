import type { ProjectCreateBody, ReadingLimits, TemplateField } from "./api";

export type Preset = {
  id: string;
  icon: string;
  name: string;
  audience: string;
  blurb: string;
  body: ProjectCreateBody;
};

const f = (name: string, label: string, type = "string"): TemplateField => ({ name, label, type });

// Starting points for different buyers. Every one is just a normal template —
// pick one, then edit any field before creating the project.
export const PRESETS: Preset[] = [
  {
    id: "gov-rfq",
    icon: "landmark",
    name: "Government RFQs",
    audience: "Gov contractors, bid teams",
    blurb: "SAM.gov / DLA solicitations: IDs, deadlines, NAICS, set-asides, part numbers.",
    body: {
      name: "Government RFQs",
      description: "US federal solicitations, RFQs and combined synopses.",
      relevance_scope:
        "IN SCOPE: RFQs, solicitations, and combined synopsis/solicitations that carry a solicitation number, an issuing agency, and something to act on (a deadline, price schedule, or line items). OUT OF SCOPE: wage determinations, clauses-by-reference lists, drawings without line items, sources-sought notices, amendments, and blank or viewer-error pages.",
      required: ["solicitation_number", "title"],
      fields: [
        f("solicitation_number", "Solicitation / RFQ number"),
        f("title", "Title"),
        f("agency", "Agency"),
        f("response_deadline", "Response deadline", "date"),
        f("naics_code", "NAICS code", "naics"),
        f("set_aside", "Set-aside"),
        f("place_of_performance", "Place of performance"),
        f("contact_email", "Contact email", "email"),
        f("part_numbers", "Part / NSN numbers", "string_list"),
        f("quantity", "Quantity", "number"),
        f("description_summary", "Description summary"),
      ],
    },
  },
  {
    id: "invoices",
    icon: "receipt",
    name: "Supplier invoices",
    audience: "Finance & AP teams",
    blurb: "Invoice numbers, vendors, dates, totals and tax — ready for your ledger.",
    body: {
      name: "Supplier invoices",
      description: "Accounts-payable invoices requesting payment for goods or services.",
      relevance_scope:
        "IN SCOPE: an invoice or bill from a supplier requesting payment, with an invoice number and an amount due. OUT OF SCOPE: quotes, purchase orders, statements of account, paid receipts, marketing material, and remittance advice.",
      required: ["invoice_number", "vendor_name", "total_amount"],
      fields: [
        f("invoice_number", "Invoice number"),
        f("vendor_name", "Vendor"),
        f("invoice_date", "Invoice date", "date"),
        f("due_date", "Due date", "date"),
        f("po_number", "PO number"),
        f("currency", "Currency"),
        f("subtotal", "Subtotal", "number"),
        f("tax_amount", "Tax", "number"),
        f("total_amount", "Total", "number"),
        f("payment_terms", "Payment terms"),
        f("line_items", "Line items", "string_list"),
        f("vendor_email", "Vendor email", "email"),
      ],
    },
  },
  {
    id: "purchase-orders",
    icon: "cart",
    name: "Purchase orders",
    audience: "Sales ops, order desks",
    blurb: "Turn inbound POs into order lines: buyer, ship-to, dates, items, totals.",
    body: {
      name: "Purchase orders",
      description: "Customer purchase orders received by an order desk.",
      relevance_scope:
        "IN SCOPE: a purchase order from a buyer authorizing a purchase, with a PO number and line items. OUT OF SCOPE: invoices, quotes, order confirmations we sent, shipping notices, and general correspondence.",
      required: ["po_number", "buyer_company"],
      fields: [
        f("po_number", "PO number"),
        f("buyer_company", "Buyer"),
        f("order_date", "Order date", "date"),
        f("requested_delivery_date", "Requested delivery", "date"),
        f("ship_to_address", "Ship-to address"),
        f("line_items", "Line items", "string_list"),
        f("total_amount", "Total", "number"),
        f("payment_terms", "Payment terms"),
        f("contact_email", "Buyer contact", "email"),
      ],
    },
  },
  {
    id: "resumes",
    icon: "briefcase",
    name: "Resumes & CVs",
    audience: "Recruiters, staffing agencies",
    blurb: "Candidate name, contact, title, experience and skills from any CV format.",
    body: {
      name: "Resumes & CVs",
      description: "Candidate resumes and CVs submitted for open roles.",
      relevance_scope:
        "IN SCOPE: a resume or CV describing one individual candidate's experience. OUT OF SCOPE: job descriptions, cover letters on their own, company profiles, reference letters, and certificates.",
      required: ["full_name"],
      fields: [
        f("full_name", "Full name"),
        f("email", "Email", "email"),
        f("phone", "Phone"),
        f("location", "Location"),
        f("current_title", "Current title"),
        f("years_experience", "Years of experience", "number"),
        f("skills", "Skills", "string_list"),
        f("previous_employers", "Previous employers", "string_list"),
        f("education", "Highest education"),
      ],
    },
  },
  {
    id: "leases",
    icon: "key",
    name: "Commercial leases",
    audience: "Property managers, real estate",
    blurb: "Parties, premises, term dates, rent, deposit and renewal terms.",
    body: {
      name: "Commercial leases",
      description: "Signed commercial lease agreements and renewals.",
      relevance_scope:
        "IN SCOPE: a lease agreement (or renewal/extension) between a landlord and a tenant for a specific property. OUT OF SCOPE: property listings, brochures, maintenance requests, inspection reports, and rent invoices.",
      required: ["tenant", "property_address"],
      fields: [
        f("landlord", "Landlord"),
        f("tenant", "Tenant"),
        f("property_address", "Property address"),
        f("lease_start", "Lease start", "date"),
        f("lease_end", "Lease end", "date"),
        f("monthly_rent", "Monthly rent", "number"),
        f("security_deposit", "Security deposit", "number"),
        f("renewal_option", "Renewal option"),
        f("notice_period_days", "Notice period (days)", "number"),
        f("permitted_use", "Permitted use"),
      ],
    },
  },
  {
    id: "insurance-claims",
    icon: "shield",
    name: "Insurance claims",
    audience: "Claims & insurance ops",
    blurb: "First notice of loss: policy, claimant, incident date, type and estimate.",
    body: {
      name: "Insurance claims",
      description: "First-notice-of-loss forms and claim submissions.",
      relevance_scope:
        "IN SCOPE: a claim submission or first notice of loss describing an incident under a policy. OUT OF SCOPE: policy documents themselves, marketing, premium invoices, and general correspondence without a claim.",
      required: ["policy_number", "claimant_name"],
      fields: [
        f("claim_number", "Claim number"),
        f("policy_number", "Policy number"),
        f("claimant_name", "Claimant"),
        f("incident_date", "Incident date", "date"),
        f("incident_location", "Incident location"),
        f("claim_type", "Claim type"),
        f("estimated_loss", "Estimated loss", "number"),
        f("description_summary", "What happened"),
        f("contact_email", "Contact email", "email"),
      ],
    },
  },
  {
    id: "bills-of-lading",
    icon: "package",
    name: "Shipping documents",
    audience: "Freight forwarders, logistics",
    blurb: "Bills of lading: shipper, consignee, ports, containers and weights.",
    body: {
      name: "Shipping documents",
      description: "Bills of lading and related shipping paperwork.",
      relevance_scope:
        "IN SCOPE: a bill of lading or sea/air waybill for a specific shipment. OUT OF SCOPE: commercial invoices, packing lists without carrier details, rate quotes, and customs forms.",
      required: ["bol_number"],
      fields: [
        f("bol_number", "B/L number"),
        f("shipper", "Shipper"),
        f("consignee", "Consignee"),
        f("carrier", "Carrier"),
        f("origin_port", "Port of loading"),
        f("destination_port", "Port of discharge"),
        f("ship_date", "Ship date", "date"),
        f("container_numbers", "Containers", "string_list"),
        f("gross_weight_kg", "Gross weight (kg)", "number"),
        f("commodity_description", "Commodity"),
      ],
    },
  },
  {
    id: "vehicles",
    icon: "car",
    name: "Vehicle listings",
    audience: "Dealers, marketplaces",
    blurb: "Make, model, year, price, mileage and VIN from any listing or ad.",
    body: {
      name: "Vehicle listings",
      description: "Listings and ads for individual vehicles for sale.",
      relevance_scope:
        "IN SCOPE: a listing or ad for one specific vehicle for sale, with make/model and price. OUT OF SCOPE: general articles, dealership homepages, financing offers, and anything without a specific vehicle.",
      required: ["make", "model"],
      fields: [
        f("make", "Make"),
        f("model", "Model"),
        f("year", "Year", "number"),
        f("price", "Price", "number"),
        f("mileage", "Mileage", "number"),
        f("vin", "VIN"),
        f("fuel_type", "Fuel"),
        f("transmission", "Transmission"),
        f("location", "Location"),
        f("seller_contact", "Seller contact"),
      ],
    },
  },
  {
    id: "contracts",
    icon: "pen",
    name: "Contracts",
    audience: "Legal ops, procurement",
    blurb: "NDAs and MSAs: parties, effective dates, term, renewal and governing law.",
    body: {
      name: "Contracts",
      description: "Executed commercial agreements such as NDAs and MSAs.",
      relevance_scope:
        "IN SCOPE: an agreement between named parties with obligations and a term (NDA, MSA, SOW, service agreement). OUT OF SCOPE: invoices, proposals, marketing, and unsigned templates with blank party names.",
      required: ["party_a", "party_b"],
      fields: [
        f("contract_type", "Contract type"),
        f("party_a", "Party A"),
        f("party_b", "Party B"),
        f("effective_date", "Effective date", "date"),
        f("term_end_date", "Term end", "date"),
        f("auto_renewal", "Auto-renewal"),
        f("termination_notice_days", "Termination notice (days)", "number"),
        f("governing_law", "Governing law"),
        f("payment_terms", "Payment terms"),
        f("key_obligations_summary", "Key obligations"),
      ],
    },
  },
];

// A project's template, as portable JSON — the same shape the create API
// takes, so a file exported from one install imports cleanly into another.
export type TemplateFile = ProjectCreateBody & { format: "document-extractor/template@1" };

export function toTemplateFile(body: ProjectCreateBody): TemplateFile {
  return { format: "document-extractor/template@1", ...body };
}

export function parseTemplateFile(text: string): ProjectCreateBody {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.fields)) {
    throw new Error("Not a template file — expected an object with a \"fields\" array.");
  }
  return {
    name: String(raw.name || ""),
    description: raw.description ? String(raw.description) : "",
    relevance_scope: raw.relevance_scope ? String(raw.relevance_scope) : "",
    system_extra: raw.system_extra ? String(raw.system_extra) : "",
    required: Array.isArray(raw.required) ? raw.required.map(String) : [],
    fields: raw.fields.map((x: Record<string, unknown>) => ({
      name: String(x.name || ""),
      type: String(x.type || "string"),
      label: String(x.label || x.name || ""),
      description: x.description ? String(x.description) : "",
    })),
    conf_threshold: typeof raw.conf_threshold === "number" ? raw.conf_threshold : undefined,
    reading: parseReading(raw.reading),
  };
}

// Older template files have no "reading" block; anything not a number means
// "use the default" so a hand-edited file can't smuggle in junk.
function parseReading(raw: unknown): ReadingLimits | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
  return {
    max_pdf_pages: num(r.max_pdf_pages),
    scanned_ocr_pages: num(r.scanned_ocr_pages),
    extract_chars: num(r.extract_chars),
    triage_chars: num(r.triage_chars),
  };
}
