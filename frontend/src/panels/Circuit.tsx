import { useMemo } from "react";

/** Make Qiskit's SVG fill the panel, but scroll sideways instead of shrinking a wide circuit. */
export function fitSvg(svg: string): string {
  const box = svg.match(/viewBox="([^"]+)"/);
  const width = box ? Number(box[1].trim().split(/\s+/)[2]) : 400;
  return svg
    .replace(/(<svg[^>]*?)\swidth="[^"]*"/, "$1")
    .replace(/(<svg[^>]*?)\sheight="[^"]*"/, "$1")
    .replace(
      "<svg",
      `<svg style="display:block;width:100%;height:auto;min-width:${Math.round(width * 0.6)}px;max-width:${Math.round(width * 2)}px"`,
    );
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function Circuit({
  svg,
  gateCount,
  nQubits,
  isAmplitude,
}: {
  svg: string;
  gateCount: number;
  nQubits: number;
  isAmplitude: boolean;
}) {
  const html = useMemo(() => fitSvg(svg), [svg]);
  const caption = isAmplitude
    ? `1 box that unpacks into ${plural(gateCount, "gate")}, ${plural(nQubits, "qubit")}.`
    : `${plural(gateCount, "gate")}, ${plural(nQubits, "qubit")}.`;
  return (
    <div className="flex flex-1 flex-col justify-between gap-4">
      <div className="overflow-x-auto rounded-xl bg-black p-2" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="text-2xl font-semibold text-white">{caption}</p>
    </div>
  );
}
