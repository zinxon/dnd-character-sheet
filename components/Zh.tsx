import zh from "@/data/zh.json";

const ZH = zh as Record<string, string>;

// Traditional Chinese gloss after an English label — the same bilingual
// pattern the classic sheet's injected layer used.
export function Zh({ text }: { text: string }) {
  const gloss = ZH[text];
  if (!gloss) return null;
  return (
    <span className="ml-1.5 text-[0.8em] font-normal whitespace-nowrap text-muted-foreground">
      {gloss}
    </span>
  );
}

export const zhOf = (text: string): string | null => ZH[text] ?? null;
