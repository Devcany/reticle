// Reticle — marker.js
// ArUco SVG marker generator.
//
// Format: js-aruco compatible (5x5 inner bits, 7x7 total including 1-cell black border).
// This is the ORIGINAL ArUco format, not OpenCV DICT_4X4_50.
// The same encoding is used by vendor/aruco.js for P3 detection.
//
// ID space: 0-1023 (10 data bits: 5 rows x 2 bits per row).
// Each row is encoded as a Hamming(5,2) codeword using the 4 valid words below.

// Hamming code words from aruco.js hammingDistance().
// Index encodes (bit1 << 1 | bit3) where bit1 and bit3 are the 2 data bits per row.
// bits[i][1] and bits[i][3] are the data bits; bits[i][0,2,4] are parity.
const WORDS = [
  [1, 0, 0, 0, 0],  // data: 00
  [1, 0, 1, 1, 1],  // data: 01
  [0, 1, 0, 0, 1],  // data: 10
  [0, 1, 1, 1, 0],  // data: 11
];

// Generate 5x5 inner bit matrix for a given marker ID.
// Compatible with AR.Detector.mat2id() decoding in aruco.js.
function innerBits(id) {
  const rows = [];
  for (let row = 0; row < 5; row++) {
    const shift = 9 - 2 * row;
    const b1 = (id >> shift) & 1;
    const b3 = (id >> (shift - 1)) & 1;
    rows.push([...WORDS[(b1 << 1) | b3]]);
  }
  return rows;
}

// Generate an ArUco SVG string.
// id:     marker ID (integer 0-1023)
// sizeMm: physical size in mm (e.g. 6, 8, 12)
// Returns: SVG string with width/height in mm, white background, black cells.
export function generateMarkerSVG(id, sizeMm) {
  const bits = innerBits(id);
  // 7x7 grid: 1-cell black border + 5x5 inner bits
  const GRID = 7;
  const cell = sizeMm / GRID;
  const c = (n) => (n * cell).toFixed(4);

  const rects = [];

  // Helper: emit a black cell at grid position (col, row)
  const black = (col, row) =>
    `<rect x="${c(col)}" y="${c(row)}" width="${c(1)}" height="${c(1)}" fill="#000"/>`;

  // Top border row
  for (let col = 0; col < GRID; col++) rects.push(black(col, 0));
  // Bottom border row
  for (let col = 0; col < GRID; col++) rects.push(black(col, 6));
  // Left + right border columns (rows 1-5)
  for (let row = 1; row <= 5; row++) {
    rects.push(black(0, row));
    rects.push(black(6, row));
  }

  // Inner 5x5 data bits (row 1-5, col 1-5 in grid coords)
  for (let r = 0; r < 5; r++) {
    for (let c2 = 0; c2 < 5; c2++) {
      if (bits[r][c2] === 1) rects.push(black(c2 + 1, r + 1));
    }
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    `  width="${sizeMm}mm" height="${sizeMm}mm"`,
    `  viewBox="0 0 ${sizeMm} ${sizeMm}"`,
    `  shape-rendering="crispEdges">`,
    `  <rect width="${sizeMm}" height="${sizeMm}" fill="#fff"/>`,
    ...rects,
    `</svg>`,
  ].join('\n');
}
