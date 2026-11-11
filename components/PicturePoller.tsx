"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Pictures are looked up in the background after adding products; refresh a few times so they appear on their own. */
export default function PicturePoller({ active }: { active: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let n = 0;
    const id = setInterval(() => { router.refresh(); if (++n >= 5) clearInterval(id); }, 3000);
    return () => clearInterval(id);
  }, [active, router]);
  return null;
}
