// Word-synced captions in the style of the Monkey King staff reference:
// ALL CAPS, up to two words per chunk, first word white and second coloured,
// colours cycling, hard cut on each chunk (no pop animation).
import React from "react";
import { AbsoluteFill, continueRender, delayRender, staticFile } from "remotion";

export const fontFamily = "MontserratBlack";
const handle = delayRender("Loading Montserrat");
new FontFace(fontFamily, `url(${staticFile("fonts/Montserrat-900.woff2")}) format("woff2")`, { weight: "900" })
  .load()
  .then((f) => {
    document.fonts.add(f);
    continueRender(handle);
  })
  .catch((e) => {
    console.error(e);
    continueRender(handle);
  });

const COLORS = ["#3ee05a", "#ff3b3b", "#ff5fc8", "#ffe14d", "#3fe6ff"];

type Word = { w: string; s: number; e: number };
type Chunk = { words: string[]; s: number; end: number; color: number };

const clean = (w: string) => w.replace(/[.,!?;:"]/g, "").toUpperCase();

export const buildChunks = (words: Word[]): Chunk[] => {
  const chunks: Chunk[] = [];
  let cur: Word[] = [];
  const flush = () => {
    if (!cur.length) return;
    chunks.push({ words: cur.map((x) => clean(x.w)), s: cur[0].s, end: cur[cur.length - 1].e, color: chunks.length % COLORS.length });
    cur = [];
  };
  for (const w of words) {
    const long = clean(w.w).length >= 10;
    if (long) {
      flush();
      cur = [w];
      flush();
      continue;
    }
    cur.push(w);
    if (cur.length === 2 || /[.,!?]$/.test(w.w)) flush();
  }
  flush();
  // each chunk stays up until the next starts, unless there's a real pause
  for (let i = 0; i < chunks.length; i++) {
    const next = chunks[i + 1];
    chunks[i].end = next ? Math.min(next.s, chunks[i].end + 0.45) : chunks[i].end + 0.6;
  }
  return chunks;
};

// chunk lists cached per word array, so several videos can share this component
const cache = new WeakMap<Word[], Chunk[]>();

export const Captions: React.FC<{ words: Word[]; t: number; y?: number }> = ({ words, t, y = 0.62 }) => {
  let chunks = cache.get(words);
  if (!chunks) {
    chunks = buildChunks(words);
    cache.set(words, chunks);
  }
  const c = chunks.find((x) => t >= x.s && t < x.end);
  if (!c) return null;
  const style: React.CSSProperties = {
    fontFamily,
    fontWeight: 900,
    fontSize: 70,
    letterSpacing: 2,
    textShadow: "0 6px 14px rgba(0,0,0,0.55), 0 2px 3px rgba(0,0,0,0.6)",
    WebkitTextStroke: "2px rgba(0,0,0,0.35)",
  };
  const color = COLORS[c.color];
  return (
    <AbsoluteFill style={{ top: `${y * 100}%`, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 22, transform: "translateY(-50%)" }}>
        {c.words.length === 1 ? (
          <span style={{ ...style, color }}>{c.words[0]}</span>
        ) : (
          <>
            <span style={{ ...style, color: "#ffffff" }}>{c.words[0]}</span>
            <span style={{ ...style, color }}>{c.words[1]}</span>
          </>
        )}
      </div>
    </AbsoluteFill>
  );
};
