/** Helpers for building the WhatsApp message. Safe to import on server and client. */
type OfferText = { offer_text: string; discount_detail: string | null; valid_to: string | null; share_message: string | null };

/** The message text sent with the image. Uses the model-written share_message when present. */
export function buildShareText(o: OfferText, url: string): string {
  const body = o.share_message?.trim()
    ? o.share_message.trim()
    : [o.offer_text, o.discount_detail, o.valid_to ? `Valid till ${o.valid_to}` : null].filter(Boolean).join("\n");
  return `${body}\n\n${url}`;
}

/** wa.me needs digits only with country code. 10-digit Indian numbers get 91 prefixed. */
export function waPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `91${d}` : d;
}

export const waChatLink = (phone: string, text: string) => `https://wa.me/${waPhone(phone)}?text=${encodeURIComponent(text)}`;
export const waPickerLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
