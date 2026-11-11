"use client";
import { useState } from "react";
import { waChatLink, waPickerLink } from "@/lib/share";

type Member = { contact_name: string; phone: string };

/**
 * Sharing flow:
 *  1. "Share image + message" uses the device share sheet (Web Share API with a file). Picking WhatsApp there
 *     opens WhatsApp's own contact picker with search, with the offer image and message already attached.
 *  2. Fallback for browsers without file sharing: download/copy the image, copy the message, open WhatsApp.
 *  3. Per-contact buttons open a chat with that buyer with the message + link prefilled (link preview shows the image).
 * WhatsApp does not allow attaching an image through a plain link, which is why the share sheet is the main path.
 */
export default function ShareOffer({ imageUrl, url, text, members }: { imageUrl: string; url: string; text: string; members: Member[] }) {
  const [note, setNote] = useState("");
  const [showMore, setShowMore] = useState(false);
  const flash = (s: string) => { setNote(s); setTimeout(() => setNote(""), 4000); };

  async function getFile() {
    const blob = await (await fetch(imageUrl)).blob();
    return new File([blob], "offer.png", { type: "image/png" });
  }

  async function nativeShare() {
    try {
      const data = { files: [await getFile()], text };
      if (navigator.canShare?.(data)) { await navigator.share(data); return; }
      setShowMore(true);
      flash("This browser can't share images directly. Use the options below.");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setShowMore(true);
      flash("Could not open the share sheet. Use the options below.");
    }
  }

  async function copyImage() {
    try {
      const f = await getFile();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": f })]);
      flash("Image copied. Paste it into the WhatsApp chat.");
    } catch { flash("Copy not supported here. Use Download image."); }
  }

  async function copyText() {
    try { await navigator.clipboard.writeText(text); flash("Message copied."); } catch { flash("Could not copy."); }
  }

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={nativeShare}>Share image + message</button>
        <button type="button" className="btn-secondary" onClick={() => setShowMore((v) => !v)}>{showMore ? "Hide options" : "More options"}</button>
      </div>
      {note && <p className="text-xs text-amber-700">{note}</p>}
      {showMore && (
        <div className="space-y-3 rounded border bg-gray-50 p-3 text-sm">
          <div className="flex flex-wrap gap-2">
            <a className="btn-secondary" href={imageUrl} download="offer.png" target="_blank" rel="noreferrer">Download image</a>
            <button type="button" className="btn-secondary" onClick={copyImage}>Copy image</button>
            <button type="button" className="btn-secondary" onClick={copyText}>Copy message</button>
            <a className="btn-secondary" target="_blank" rel="noreferrer" href={waPickerLink(text)}>Open WhatsApp (pick contact)</a>
          </div>
          <p className="text-xs text-gray-600">Tip: on desktop, copy the image, open WhatsApp, search the contact, then paste the image and the message.</p>
          {members.length > 0 && (
            <div>
              <p className="mb-1 font-medium">Send to a buyer in this group</p>
              <ul className="max-h-48 divide-y overflow-auto rounded border bg-white">
                {members.map((m) => (
                  <li key={m.phone} className="flex items-center justify-between px-2 py-1.5">
                    <span>{m.contact_name} <span className="text-gray-500">· {m.phone}</span></span>
                    <a className="text-emerald-700 underline" target="_blank" rel="noreferrer" href={waChatLink(m.phone, text)}>Send</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
