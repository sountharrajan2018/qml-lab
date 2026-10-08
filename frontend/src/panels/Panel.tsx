import type { ReactNode } from "react";

/** One of the three panels. During Explain, the panel in focus shows its caption. */
export default function Panel({
  step,
  title,
  sentence,
  caption,
  dimmed,
  children,
}: {
  step: number;
  title: string;
  sentence: string;
  caption: string | null;
  dimmed: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex min-w-0 flex-col rounded-2xl border bg-zinc-950 p-6 transition-opacity duration-300 ${
        caption ? "border-amber-300 ring-4 ring-amber-300/40" : "border-zinc-800"
      } ${dimmed ? "opacity-15" : "opacity-100"}`}
    >
      <h2 className="text-2xl font-bold text-white">
        <span className="mr-3 text-zinc-500">{step}</span>
        {title}
      </h2>
      <p className="mt-1 text-lg text-zinc-300">{sentence}</p>
      {caption && (
        <p className="mt-4 rounded-xl bg-amber-300 px-4 py-3 text-xl font-semibold text-black">
          {caption}
        </p>
      )}
      <div className="mt-5 flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
