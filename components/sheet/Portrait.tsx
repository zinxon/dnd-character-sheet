"use client";

import { useRef, useState } from "react";
import { ImagePlusIcon, XIcon } from "lucide-react";

// Longest side of the stored image. Portraits live inside the character's
// JSON (as a data URL, like the classic sheet), so keep them small.
const MAX_SIDE = 512;

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/webp", 0.85);
}

export function Portrait({
  src,
  name,
  onChange,
  className = "size-24",
}: {
  src: string;
  name: string;
  onChange: (dataUrl: string) => void;
  /** Size classes for the box (default 96px). */
  className?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      onChange(await fileToDataUrl(file));
    } catch {
      setError("Can't read that image — try PNG, JPEG or WebP.");
    }
  };

  return (
    <div className="group relative shrink-0">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`flex ${className} items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground hover:border-foreground/30`}
        aria-label={src ? "Change portrait" : "Upload portrait"}
        title={error || (src ? "Change portrait" : "Upload portrait")}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL
          <img src={src} alt={name} className="size-full object-cover" />
        ) : (
          <ImagePlusIcon className="size-6" />
        )}
      </button>
      {src && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute -top-2 -right-2 hidden size-6 items-center justify-center rounded-full border bg-background shadow group-hover:flex"
          aria-label="Remove portrait"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && <p className="mt-1 max-w-24 text-xs text-destructive">{error}</p>}
    </div>
  );
}
