"use client";

import { useState } from "react";
import { compressImage } from "@/lib/image-compress";

/**
 * File input for the article cover image that shrinks the picked photo (resize
 * + WebP) IN THE BROWSER before the form submits. The article form is a plain
 * server-action POST, so we can't intercept the upload the way ProductForm
 * does; instead we swap the input's selected file for the optimized one via a
 * DataTransfer, and the smaller file rides the normal submit. Cuts Supabase
 * Storage egress on every future view of the article cover.
 *
 * Degrades gracefully: if optimization or the file swap fails, the original
 * file stays selected and uploads unchanged.
 */
export default function CoverImageInput({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const [note, setNote] = useState<string | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const el = e.currentTarget; // capture before any await
    const file = el.files?.[0];
    if (!file) {
      setNote(null);
      return;
    }
    setNote("Optimizing…");
    try {
      const out = await compressImage(file);
      if (out !== file) {
        const dt = new DataTransfer();
        dt.items.add(out);
        el.files = dt.files;
        setNote(`Optimized → ${Math.max(1, Math.round(out.size / 1024))} KB`);
      } else {
        setNote(null);
      }
    } catch {
      setNote(null); // keep the original file selected
    }
  }

  return (
    <>
      <input name={name} type="file" accept="image/*" onChange={onChange} className={className} />
      {note && <p className="text-secondary text-[11px] mt-1">{note}</p>}
    </>
  );
}
