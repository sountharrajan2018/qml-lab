import { BAD, OK } from "./colors";

export interface PictureItem {
  pixels: number[];
  caption: string;
  mark?: "ok" | "bad";
  sub?: string;
}

function Picture({ pixels, size }: { pixels: number[]; size: string }) {
  return (
    <div className={`grid ${size} grid-cols-4 gap-px rounded border border-zinc-600 bg-zinc-700 p-px`}>
      {pixels.map((v, i) => (
        <div key={i} className="aspect-square" style={{ background: v ? "#fff" : "#000" }} />
      ))}
    </div>
  );
}

/** A wall of small 4x4 pictures with a caption (and optional ✓/✗) under each. */
export default function Pictures({ items, big = false }: { items: PictureItem[]; big?: boolean }) {
  return (
    <div className={`grid gap-4 ${big ? "grid-cols-5" : "grid-cols-8 xl:grid-cols-11"}`}>
      {items.map((it, i) => (
        <figure key={i} className="flex flex-col items-center gap-1">
          <Picture pixels={it.pixels} size={big ? "w-24" : "w-16"} />
          <figcaption className="text-center text-sm leading-tight text-zinc-200">
            {it.mark && (
              <span className="mr-1 font-bold" style={{ color: it.mark === "ok" ? OK : BAD }}>
                {it.mark === "ok" ? "✓" : "✗"}
              </span>
            )}
            {it.caption}
            {it.sub && <div className="text-xs text-zinc-400">{it.sub}</div>}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
