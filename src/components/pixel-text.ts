// A tiny 5×7 bitmap font: no downloads or font-loading flashes on the canvas.
const GLYPHS: Record<string, string> = {
  A: "01110 10001 10001 11111 10001 10001 10001",
  B: "11110 10001 10001 11110 10001 10001 11110",
  C: "01111 10000 10000 10000 10000 10000 01111",
  D: "11110 10001 10001 10001 10001 10001 11110",
  E: "11111 10000 10000 11110 10000 10000 11111",
  F: "11111 10000 10000 11110 10000 10000 10000",
  G: "01111 10000 10000 10111 10001 10001 01111",
  H: "10001 10001 10001 11111 10001 10001 10001",
  I: "111 010 010 010 010 010 111",
  J: "00111 00010 00010 00010 10010 10010 01100",
  K: "10001 10010 10100 11000 10100 10010 10001",
  L: "10000 10000 10000 10000 10000 10000 11111",
  M: "10001 11011 10101 10101 10001 10001 10001",
  N: "10001 11001 10101 10011 10001 10001 10001",
  O: "01110 10001 10001 10001 10001 10001 01110",
  P: "11110 10001 10001 11110 10000 10000 10000",
  Q: "01110 10001 10001 10001 10101 10010 01101",
  R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110",
  T: "11111 00100 00100 00100 00100 00100 00100",
  U: "10001 10001 10001 10001 10001 10001 01110",
  V: "10001 10001 10001 10001 10001 01010 00100",
  W: "10001 10001 10001 10101 10101 10101 01010",
  X: "10001 10001 01010 00100 01010 10001 10001",
  Y: "10001 10001 01010 00100 00100 00100 00100",
  Z: "11111 00001 00010 00100 01000 10000 11111",
  "0": "01110 10001 10011 10101 11001 10001 01110",
  "1": "010 110 010 010 010 010 111",
  "2": "01110 10001 00001 00010 00100 01000 11111",
  "3": "11110 00001 00001 01110 00001 00001 11110",
  "4": "00010 00110 01010 10010 11111 00010 00010",
  "5": "11111 10000 10000 11110 00001 00001 11110",
  "6": "01110 10000 10000 11110 10001 10001 01110",
  "7": "11111 00001 00010 00100 01000 01000 01000",
  "8": "01110 10001 10001 01110 10001 10001 01110",
  "9": "01110 10001 10001 01111 00001 00001 01110",
  " ": "000 000 000 000 000 000 000",
  ".": "0 0 0 0 0 0 1",
  "…": "00000 00000 00000 00000 00000 00000 10101",
  "-": "000 000 000 111 000 000 000",
  ":": "0 0 1 0 1 0 0",
  "/": "00001 00010 00010 00100 01000 01000 10000",
  "!": "1 1 1 1 1 0 1",
  "?": "01110 10001 00001 00010 00100 00000 00100",
  "'": "1 1 0 0 0 0 0",
  "&": "01100 10010 01000 11111 00010 01001 00110",
};

function glyph(character: string): string[] {
  return (GLYPHS[character.toUpperCase()] ?? GLYPHS["?"]).split(" ");
}

export function pixelTextWidth(text: string, pixel: number): number {
  return Math.max(0, [...text].reduce((width, character) => width + glyph(character)[0].length + 1, 0) - 1) * pixel;
}

export function clipPixelText(text: string, maxWidth: number, pixel: number): string {
  if (pixelTextWidth(text, pixel) <= maxWidth) return text;
  let clipped = text;
  while (clipped.length && pixelTextWidth(`${clipped}…`, pixel) > maxWidth) clipped = clipped.slice(0, -1);
  return `${clipped}…`;
}

export function paintPixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, pixel: number): void {
  let cursor = x;
  for (const character of text) {
    const rows = glyph(character);
    rows.forEach((row, rowIndex) => {
      [...row].forEach((bit, column) => {
        if (bit === "1") {
          const left = Math.round(cursor + column * pixel);
          const top = Math.round(y + rowIndex * pixel);
          ctx.fillRect(left, top, Math.round(cursor + (column + 1) * pixel) - left, Math.round(y + (rowIndex + 1) * pixel) - top);
        }
      });
    });
    cursor += (rows[0].length + 1) * pixel;
  }
}
