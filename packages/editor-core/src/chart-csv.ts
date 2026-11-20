export type CsvDelimiter = "," | "\t" | ";";

export interface ChartCsvTable {
  headers: string[];
  rows: { line: number; cells: string[] }[];
}

export interface ChartCsvSelection {
  xColumn: number;
  yColumns: number[];
  labels?: string[];
  role?: "observed" | "curve";
}

export interface ChartCsvSeries {
  label: string;
  points: { x: number; y: number }[];
  role?: "observed" | "curve";
}

export const chartCsvLimits = Object.freeze({
  maxBytes: 1_000_000,
  maxRows: 500,
  maxColumns: 32,
  maxSeries: 6,
  maxAbsValue: 1e12,
});

export function parseChartCsv(text: string, delimiter: CsvDelimiter = ","): ChartCsvTable {
  if (![",", "\t", ";"].includes(delimiter)) {
    throw new Error("区切り文字はカンマ、タブ、セミコロンから選んでください。");
  }
  if (
    text.length > chartCsvLimits.maxBytes ||
    new TextEncoder().encode(text).length > chartCsvLimits.maxBytes
  ) {
    throw new Error("CSVは1 MB以下にしてください。");
  }
  if (text.includes("\0")) {
    throw new Error("CSVに読み取れない文字があります。文字コードを確認してください。");
  }

  const source = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows: ChartCsvTable["rows"] = [];
  let headers: string[] | undefined;
  let cells: string[] = [];
  let field = "";
  let state: "start" | "unquoted" | "quoted" | "closed" = "start";
  let line = 1;
  let recordLine = 1;
  let recordHasContent = false;

  const finishField = () => {
    if (cells.length >= chartCsvLimits.maxColumns) {
      throw new Error(`CSVの${recordLine}行目に列が多すぎます。32列までにしてください。`);
    }
    cells.push(field);
    field = "";
    state = "start";
  };
  const finishRecord = () => {
    // 空欄の値を欠測として扱うため、引用符付きの空欄や空白行は飛ばさない。
    if (!recordHasContent && headers) {
      return;
    }
    finishField();
    if (!headers) {
      headers = cells.map((cell) => cell.trim());
      if (headers.length < 2) {
        throw new Error("CSVの1行目に、XとYに使う2列以上の列名を入れてください。");
      }
      const empty = headers.findIndex((header) => !header);
      if (empty !== -1) {
        throw new Error(`CSVの1行目、${empty + 1}列目の列名を入力してください。`);
      }
      if (new Set(headers).size !== headers.length) {
        throw new Error("CSVの1行目に同じ列名があります。列ごとに異なる名前を付けてください。");
      }
    } else {
      if (cells.length !== headers.length) {
        throw new Error(
          `CSVの${recordLine}行目は${cells.length}列あります。列名と同じ${headers.length}列にしてください。`,
        );
      }
      if (rows.length >= chartCsvLimits.maxRows) {
        throw new Error("CSVのデータは500行までにしてください。列名の行は含みません。");
      }
      rows.push({ line: recordLine, cells });
    }
    cells = [];
    recordHasContent = false;
  };

  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    const newline = character === "\r" || character === "\n";
    if (state === "quoted") {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index++;
        } else {
          state = "closed";
        }
      } else if (newline) {
        field += character;
        if (character === "\r" && source[index + 1] === "\n") {
          field += "\n";
          index++;
        }
        line++;
      } else {
        field += character;
      }
      continue;
    }
    if (newline) {
      finishRecord();
      if (character === "\r" && source[index + 1] === "\n") {
        index++;
      }
      line++;
      recordLine = line;
      continue;
    }
    recordHasContent = true;
    if (character === delimiter) {
      finishField();
    } else if (character === '"' && state === "start") {
      state = "quoted";
    } else if (character === '"' || state === "closed") {
      throw new Error(
        `CSVの${line}行目、${cells.length + 1}列目の引用符を確認してください。引用符を含む値は全体を二重引用符で囲んでください。`,
      );
    } else {
      field += character;
      state = "unquoted";
    }
  }
  if (state === "quoted") {
    throw new Error(`CSVの${recordLine}行目から始まる引用符が閉じていません。`);
  }
  if (recordHasContent || !headers) {
    finishRecord();
  }
  if (!headers || rows.length === 0) {
    throw new Error("CSVには列名の行と、1行以上のデータを入れてください。");
  }
  return { headers, rows };
}

const decimal = /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?$/u;

export function mapChartCsv(table: ChartCsvTable, selection: ChartCsvSelection): ChartCsvSeries[] {
  const validColumn = (column: number) =>
    Number.isInteger(column) && column >= 0 && column < table.headers.length;
  if (!validColumn(selection.xColumn)) {
    throw new Error("Xに使う列を選んでください。");
  }
  if (
    selection.yColumns.length < 1 ||
    selection.yColumns.length > chartCsvLimits.maxSeries ||
    selection.yColumns.some((column) => !validColumn(column)) ||
    new Set(selection.yColumns).size !== selection.yColumns.length
  ) {
    throw new Error("Yに使う列を、重複しないように1〜6列選んでください。");
  }
  if (selection.yColumns.includes(selection.xColumn)) {
    throw new Error("XとYには異なる列を選んでください。");
  }
  if (selection.role !== undefined && !["observed", "curve"].includes(selection.role)) {
    throw new Error("データの種類は測定値または計算済み曲線を選んでください。");
  }
  if (table.rows.length < 1 || table.rows.length > chartCsvLimits.maxRows) {
    throw new Error("CSVのデータは1〜500行にしてください。");
  }
  if (selection.labels && selection.labels.length !== selection.yColumns.length) {
    throw new Error("選んだYの列ごとに系列名を入力してください。");
  }
  const labels = selection.yColumns.map((column, index) =>
    (selection.labels?.[index] ?? table.headers[column]!).trim(),
  );
  if (labels.some((label) => label.length < 1 || label.length > 100)) {
    throw new Error("系列名は1〜100文字で入力してください。");
  }
  const numberAt = (row: ChartCsvTable["rows"][number], column: number) => {
    const cell = row.cells[column]?.trim() ?? "";
    const number = Number(cell);
    if (!decimal.test(cell) || !Number.isFinite(number)) {
      throw new Error(
        `CSVの${row.line}行目、「${table.headers[column]}」（${column + 1}列目）を数値にしてください。空欄や数式、単位付きの値は取り込めません。`,
      );
    }
    if (number === 0 && /[1-9]/u.test(cell.split(/[eE]/u)[0]!)) {
      throw new Error(
        `CSVの${row.line}行目、「${table.headers[column]}」（${column + 1}列目）の値が小さすぎます。単位を変更して、0にならない値にしてください。`,
      );
    }
    if (Math.abs(number) > chartCsvLimits.maxAbsValue) {
      throw new Error(
        `CSVの${row.line}行目、「${table.headers[column]}」（${column + 1}列目）の値は、絶対値を1兆以下にしてください。`,
      );
    }
    return number;
  };
  const xs = table.rows.map((row) => numberAt(row, selection.xColumn));
  if (selection.role === "curve") {
    if (xs.length < 2) {
      throw new Error("計算済み曲線には2行以上のデータを入れてください。");
    }
    const unordered = xs.findIndex((x, index) => index > 0 && x <= xs[index - 1]!);
    if (unordered !== -1) {
      throw new Error(
        `CSVの${table.rows[unordered]!.line}行目のXを確認してください。計算済み曲線はXを小さい順に並べ、重複を除いてください。`,
      );
    }
  }
  return selection.yColumns.map((column, index) => ({
    label: labels[index]!,
    points: table.rows.map((row, rowIndex) => ({
      x: xs[rowIndex]!,
      y: numberAt(row, column),
    })),
    ...(selection.role === undefined ? {} : { role: selection.role }),
  }));
}
