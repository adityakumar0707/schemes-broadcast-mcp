/**
 * Server-side guardrails. These are deterministic rules (no AI/LLM calls) that run on EVERY path
 * that stores or publishes text: the MCP tools, the dashboard forms and the approval step.
 *
 * What they can and cannot do: this app cannot control what a distributor's own Claude/ChatGPT says
 * in chat. It CAN refuse to store or publish anything outside its purpose, and it tells the model
 * its scope via the MCP `instructions`. A human also approves every offer before it goes public.
 */

export const LIMITS = {
  productName: 100,
  groupName: 60,
  contactName: 60,
  offerText: 280,
  discountDetail: 200,
  shareMessage: 600,
  maxPriceInr: 1_000_000,
  maxDiscountPct: 90,
  productsPerUpload: 10, // dashboard file upload
  productsPerMcpCall: 50,
  maxProducts: 500,
  maxMembersPerGroup: 500,
  maxOffersPer24h: 20,
  maxPendingOffers: 30,
  maxValidDaysAhead: 366,
};

const w = (terms: string[]) => new RegExp(`\\b(?:${terms.join("|")})\\b`, "i");

const CATEGORY_RULES: { category: string; re: RegExp }[] = [
  { category: "adult or sexual content", re: w(["porn\\w*", "xxx", "nudes?", "naked", "erotic\\w*", "escorts?", "sexual\\w*", "sex toys?", "onlyfans", "hook-?ups?", "call girls?", "fetish\\w*"]) },
  { category: "illegal drugs", re: w(["cocaine", "heroin", "meth(?:amphetamine)?", "marijuana", "ganja", "charas", "opium", "lsd", "mdma", "hashish"]) },
  { category: "weapons or violence", re: w(["guns?", "rifles?", "firearms?", "pistols?", "ammunition", "explosives?", "bombs?", "weapons?", "grenades?"]) },
  { category: "hate or extremism", re: w(["nazi\\w*", "terroris[mt]\\w*", "genocide", "white supremac\\w*", "jihad\\w*"]) },
  { category: "gambling, crypto or financial schemes", re: w(["casino", "betting", "gambl\\w*", "lottery", "bitcoin", "crypto\\w*", "forex", "ponzi", "double your money", "guaranteed returns?", "loans?"]) },
  { category: "prescription or regulated medicine", re: w(["prescription", "antibiotics?", "steroids?", "opioids?", "abortion pills?"]) },
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RUN_RE = /\+?\d[\d\s().-]{8,}\d/g;
const URL_RE = /https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(?:com|in|net|org|io|co|xyz|ly|me|app|link|shop|store)\b/i;

export type Check = string | null; // null = ok, string = human-readable reason

/** Content checks for any free text that may be stored or shown to buyers. */
export function checkText(label: string, text: string | null | undefined, max: number, opts: { allowEmpty?: boolean } = {}): Check {
  const t = (text ?? "").trim();
  if (!t) return opts.allowEmpty ? null : `${label} is required.`;
  if (t.length > max) return `${label} is too long (max ${max} characters).`;
  for (const { category, re } of CATEGORY_RULES) {
    if (re.test(t)) return `${label} mentions ${category}. This tool only handles FMCG (everyday consumer goods) schemes for retailers, so this was blocked. Do not rephrase to get around this.`;
  }
  return null;
}

/** Extra checks for buyer-facing offer text: no personal data, links or contact details. */
export function checkPublicText(label: string, text: string | null | undefined, max: number, opts: { allowEmpty?: boolean } = {}): Check {
  const base = checkText(label, text, max, opts);
  if (base) return base;
  const t = (text ?? "").trim();
  if (!t) return null;
  if (EMAIL_RE.test(t)) return `${label} contains an email address. Offers are public, so personal contact data cannot be included.`;
  for (const m of t.match(PHONE_RUN_RE) ?? []) {
    if (m.replace(/\D/g, "").length >= 10) return `${label} contains a phone number. Offers are public, so buyer or contact data cannot be included.`;
  }
  if (URL_RE.test(t)) return `${label} contains a link or website. Only the app generates links; remove it.`;
  // Only percentages used as a discount ("20% off", "flat 20%"), not claims like "kills 99.9% germs".
  const discountRe = /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:off|discount|cash\s?back|less|extra)|(?:flat|save|get|upto|up to|extra)\s*(\d{1,3}(?:\.\d+)?)\s*%/gi;
  for (const m of t.matchAll(discountRe)) {
    const pct = m[1] ?? m[2];
    if (Number(pct) > LIMITS.maxDiscountPct) return `${label} claims a ${pct}% discount; the maximum allowed is ${LIMITS.maxDiscountPct}%. Check for a typo.`;
  }
  return null;
}

export function checkPrice(price: unknown): Check {
  if (price === null || price === undefined || price === "") return null;
  const n = Number(price);
  if (!Number.isFinite(n) || n < 0 || n > LIMITS.maxPriceInr) return `Price must be between 0 and ${LIMITS.maxPriceInr.toLocaleString("en-IN")}.`;
  return null;
}

export function checkDates(from?: string | null, to?: string | null): Check {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const f = from ? new Date(from + "T00:00:00") : null;
  const t = to ? new Date(to + "T00:00:00") : null;
  if ((from && isNaN(+f!)) || (to && isNaN(+t!))) return "Dates must be valid (YYYY-MM-DD).";
  if (f && t && t < f) return "valid_to cannot be before valid_from.";
  if (t && +t < +today - 864e5) return "valid_to is in the past.";
  if (t && +t > +today + LIMITS.maxValidDaysAhead * 864e5) return "valid_to is more than a year away.";
  return null;
}

export function checkPhone(phone: string): Check {
  const d = phone.replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? null : "Phone number must have 8 to 15 digits.";
}

export const first = (...checks: Check[]): Check => checks.find((c) => c) ?? null;

/** Instructions sent to the connected model with the MCP server. */
export const MCP_INSTRUCTIONS = `You are connected to "Schemes Broadcast", a tool for FMCG (fast-moving consumer goods) distributors in India to create trade schemes for their own retailers.

SCOPE - only do these things:
- manage the distributor's own product catalogue and buyer groups
- draft discount / combo offers for products that already exist in that catalogue, addressed to one of their own groups

REFUSE (politely, and do not call any tool) when asked to:
- do anything unrelated to FMCG schemes (general chat, coding, advice, other businesses, non-FMCG goods such as weapons, drugs, gambling, crypto, loans, prescription medicine)
- create offers or messages containing sexual, hateful, violent, deceptive or illegal content
- put any personal data in an offer or message: phone numbers, emails, names or lists of buyers or other people, other distributors' data, or external links
- promise unrealistic discounts (above 90%) or invent products that are not in the catalogue

RULES:
- Offers are always saved as PENDING. Never say an offer is live; tell the distributor to review and approve it in their dashboard.
- Resolve product_ids with list_products and group_id with list_groups first. Never guess ids.
- Write offer_text and share_message in the distributor's language style but keep them short, factual and buyer-friendly. Convert relative dates (like "Friday") to YYYY-MM-DD.
- If a tool returns a guardrail error, explain it to the user and do not try to rephrase around it.`;
