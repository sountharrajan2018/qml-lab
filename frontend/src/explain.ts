// Every sentence a student reads about an encoding lives here.
import type { Encoding } from "./api";

export interface EncodingText {
  id: Encoding;
  tab: string;
  headline: string;
  pictureIt: string;
  scaledLabel: string;
  /** Explain-mode captions: panel 1, panel 2, panel 3, formula. */
  explain: [string, string, string, string];
}

export const ENCODINGS: EncodingText[] = [
  {
    id: "basis",
    tab: "Basis",
    headline: "Each number becomes a 0 or a 1.",
    pictureIt:
      "Picture it as a row of light switches: a number above its column's middle value turns its switch on.",
    scaledLabel: "As 0 or 1",
    explain: [
      "Each number is compared with the middle value of its column: above it becomes 1, otherwise 0.",
      "An X gate flips a qubit from 0 to 1. A qubit that stays 0 gets no gate.",
      "Simple, but we threw away the detail in each number.",
      "The formula says the same thing with this row's numbers.",
    ],
  },
  {
    id: "angle",
    tab: "Angle",
    headline: "Each number tilts one qubit.",
    pictureIt:
      "Picture it as each number turning a dial: the smallest number in its column turns it 0, the largest turns it half a turn (π).",
    scaledLabel: "As tilts, from 0 to π",
    explain: [
      "Each number is stretched onto a tilt between 0 and π, which is half a turn.",
      "One RY gate per qubit tilts that qubit by its number.",
      "Bigger number, bigger tilt, one qubit per number.",
      "Each tilt splits the qubit between 0 and 1 using cos and sin of half the tilt.",
    ],
  },
  {
    id: "amplitude",
    tab: "Amplitude",
    headline: "All numbers share the qubits together.",
    pictureIt:
      "Picture it as packing numbers into a suitcase: divide them by their total length so they fit, then store them as the qubits themselves. 16 numbers need only 4 qubits.",
    scaledLabel: "Divided by their total length",
    explain: [
      "The numbers are divided by their total length, so their squares add up to 1.",
      "One box loads every number at once. Unpacked, it is a long chain of basic gates.",
      "Very few qubits, but the circuit to load them is long.",
      "Number i becomes the weight of result i, divided by the total length.",
    ],
  },
  {
    id: "iqp",
    tab: "IQP",
    headline: "Qubits tilt, then talk to each other.",
    pictureIt:
      "Picture it as angle encoding plus neighbours whispering to each other. The whole block runs twice.",
    scaledLabel: "As tilts, from 0 to π",
    explain: [
      "Each number is stretched onto a tilt between 0 and π, just like angle encoding.",
      "H spreads each qubit out, RZ turns it by its number, and ZZ links each pair of neighbours. Then it all runs again.",
      "The qubits are now entangled, which is where quantum advantage is hoped to come from.",
      "The Z parts use each number on its own; the ZZ parts use pairs of neighbouring numbers.",
    ],
  },
  {
    id: "hamiltonian",
    tab: "Hamiltonian",
    headline: "The numbers control how the qubits evolve.",
    pictureIt:
      "Picture it as the numbers setting the rules of a tiny physical system, then letting it run for one second.",
    scaledLabel: "As strengths, from 0 to 1",
    explain: [
      "Each number is stretched onto a strength between 0 and 1.",
      "H starts every qubit halfway between 0 and 1. Then the rules run in two short steps: RZ for each number, XX for each pair of neighbours.",
      "This is how physicists naturally put data into a quantum system.",
      "The numbers are the strengths in the rules H, and the qubits follow those rules for one second.",
    ],
  },
];

export const PANEL_SENTENCES = {
  numbers: "These are the numbers in this row, and how this encoding prepares them.",
  circuit: "This circuit puts the numbers into the qubits.",
  qubits: "Each bar is the chance of seeing that result when we look at the qubits.",
};
