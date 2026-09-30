// A table as a CSV file: a cell with a comma, a quote or a line break is
// quoted. The file starts with a byte order mark so that Excel reads the
// letters right. Nothing leaves the browser: the file is made here.

const cell = (value) => {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (header, rows) => [header, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');

export function downloadCsv(filename, header, rows) {
  const blob = new Blob([`﻿${toCsv(header, rows)}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
