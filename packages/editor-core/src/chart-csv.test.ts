import { describe, expect, it } from "vitest";
import { chartCsvLimits, mapChartCsv, parseChartCsv } from "./chart-csv.js";

describe("chart CSV import", () => {
  it("reads BOM, CRLF, escaped quotes and multiline notes without changing cell values", () => {
    const table = parseChartCsv(
      '\uFEFFtime, displacement ,note\r\n0,1,"a, b"\r\n1,2,"said ""hello""\r\nnext line"\r\n\r\n2,3,last\r\n',
    );
    expect(table).toEqual({
      headers: ["time", "displacement", "note"],
      rows: [
        { line: 2, cells: ["0", "1", "a, b"] },
        { line: 3, cells: ["1", "2", 'said "hello"\r\nnext line'] },
        { line: 6, cells: ["2", "3", "last"] },
      ],
    });
    expect(mapChartCsv(table, { xColumn: 0, yColumns: [1] })).toEqual([
      {
        label: "displacement",
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 2 },
          { x: 2, y: 3 },
        ],
      },
    ]);
  });

  it.each(["\t", ";"] as const)("uses the selected %j delimiter", (delimiter) => {
    const table = parseChartCsv(
      ["x", "y", "memo"].join(delimiter) +
        "\n" +
        [".5", "-2.5e+1", '"comma, still text"'].join(delimiter),
      delimiter,
    );
    expect(mapChartCsv(table, { xColumn: 0, yColumns: [1] })[0]!.points).toEqual([
      { x: 0.5, y: -25 },
    ]);
  });

  it("keeps measured order, repeated X values and unrounded numbers for multiple Y columns", () => {
    const table = parseChartCsv(" x , A , B \n2,0.123456789012345, +4 \n1,-0,5\n1,1e-12,6");
    const original = structuredClone(table);
    const series = mapChartCsv(table, {
      xColumn: 0,
      yColumns: [2, 1],
      labels: [" 条件B ", "条件A"],
      role: "observed",
    });
    expect(series.map((item) => item.label)).toEqual(["条件B", "条件A"]);
    expect(series[1]).toEqual({
      label: "条件A",
      role: "observed",
      points: [
        { x: 2, y: 0.123456789012345 },
        { x: 1, y: -0 },
        { x: 1, y: 1e-12 },
      ],
    });
    expect(table).toEqual(original);
  });

  it("accepts a supplied curve without assigning a regression model", () => {
    expect(
      mapChartCsv(parseChartCsv("x,theory\n0,1\n1,2\n2,5"), {
        xColumn: 0,
        yColumns: [1],
        role: "curve",
      }),
    ).toEqual([
      {
        label: "theory",
        role: "curve",
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 2 },
          { x: 2, y: 5 },
        ],
      },
    ]);
  });

  it.each([
    ["", "1行目"],
    ["x\n1", "2列以上"],
    ["x,\n1,2", "2列目の列名"],
    ["x, x \n1,2", "同じ列名"],
    ["x,y", "1行以上"],
    ["\nx,y\n1,2", "1行目"],
    ["x,y\n1,2,3", "2行目は3列"],
    ["x,y\n1", "2行目は1列"],
    ["x,y\n \n1,2", "2行目は1列"],
    ['x,y\n""\n1,2', "2行目は1列"],
    ['x,y\n1,"abc', "2行目から始まる引用符"],
    ['x,y\n1,abc"def', "2行目、2列目の引用符"],
    ['x,y\n1,"abc" more', "2行目、2列目の引用符"],
    ['x,y\n1, "abc"', "2行目、2列目の引用符"],
    ["x,y\n1,\0", "文字コード"],
  ])("rejects malformed data %j with an actionable error", (source, error) => {
    expect(() => parseChartCsv(source)).toThrow(error);
  });

  it.each(["", " ", "NaN", "Infinity", "-Infinity", "0x10", "=1+2", "1 mm", "1,000"])(
    "rejects a selected nonnumeric value %j at its physical line and column",
    (value) => {
      const escaped = '"' + value.replaceAll('"', '""') + '"';
      const table = parseChartCsv(`x,y,note\n0,1,"two\nlines"\n1,${escaped},last`);
      expect(() => mapChartCsv(table, { xColumn: 0, yColumns: [1] })).toThrow(
        "4行目、「y」（2列目）を数値に",
      );
    },
  );

  it("does not interpret formulas or HTML in unselected text columns", () => {
    const table = parseChartCsv('x,y,note\n0,1,=1+2\n1,2,"<script>alert(1)</script>"');
    expect(mapChartCsv(table, { xColumn: 0, yColumns: [1] })[0]!.points).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 2 },
    ]);
    expect(table.rows[1]!.cells[2]).toBe("<script>alert(1)</script>");
  });

  it.each(["1000000000001", "-1.001e12", "1e309"])(
    "rejects out-of-range or nonfinite numeric text %s",
    (value) => {
      expect(() =>
        mapChartCsv(parseChartCsv(`x,y\n1,${value}`), { xColumn: 0, yColumns: [1] }),
      ).toThrow("2行目、「y」（2列目）");
    },
  );

  it("accepts both numeric bounds", () => {
    expect(
      mapChartCsv(parseChartCsv("x,y\n-1e12,1e12"), { xColumn: 0, yColumns: [1] })[0]!.points,
    ).toEqual([{ x: -1e12, y: 1e12 }]);
  });

  it("rejects nonzero values that would underflow to zero", () => {
    expect(() =>
      mapChartCsv(parseChartCsv("x,y\n1,1e-400"), { xColumn: 0, yColumns: [1] }),
    ).toThrow("2行目、「y」（2列目）の値が小さすぎます");
    expect(
      mapChartCsv(parseChartCsv("x,y\n1,-0e-400"), { xColumn: 0, yColumns: [1] })[0]!.points,
    ).toEqual([{ x: 1, y: -0 }]);
  });

  it.each([
    { xColumn: -1, yColumns: [1] },
    { xColumn: 0.5, yColumns: [1] },
    { xColumn: 3, yColumns: [1] },
    { xColumn: 0, yColumns: [] },
    { xColumn: 0, yColumns: [1, 1] },
    { xColumn: 0, yColumns: [-1] },
    { xColumn: 0, yColumns: [3] },
    { xColumn: 0, yColumns: [0] },
    { xColumn: 0, yColumns: [1], labels: [] },
    { xColumn: 0, yColumns: [1], labels: [" "] },
    { xColumn: 0, yColumns: [1], labels: ["a".repeat(101)] },
  ])("rejects invalid column or label selection %j", (selection) => {
    expect(() => mapChartCsv(parseChartCsv("x,y,z\n1,2,3"), selection)).toThrow();
  });

  it.each([
    ["x,y\n1,2", "2行以上"],
    ["x,y\n1,2\n1,3", "3行目のX"],
    ["x,y\n2,2\n1,3", "3行目のX"],
  ])("rejects a curve that cannot be joined in X order", (source, error) => {
    expect(() =>
      mapChartCsv(parseChartCsv(source), { xColumn: 0, yColumns: [1], role: "curve" }),
    ).toThrow(error);
  });

  it("accepts 500 records and rejects the next instead of truncating it", () => {
    const source = "x,y\n" + Array.from({ length: 500 }, (_, index) => `${index},1`).join("\n");
    expect(parseChartCsv(source).rows).toHaveLength(500);
    expect(() => parseChartCsv(source + "\n500,1")).toThrow("500行まで");
  });

  it("bounds columns, selected series and UTF-8 byte size", () => {
    const headers = Array.from({ length: 33 }, (_, index) => `c${index}`);
    expect(() =>
      parseChartCsv(headers.join(",") + "\n" + headers.map(() => "1").join(",")),
    ).toThrow("32列まで");
    const table = parseChartCsv("x,a,b,c,d,e,f,g\n0,1,2,3,4,5,6,7");
    expect(mapChartCsv(table, { xColumn: 0, yColumns: [1, 2, 3, 4, 5, 6] })).toHaveLength(6);
    expect(() => mapChartCsv(table, { xColumn: 0, yColumns: [1, 2, 3, 4, 5, 6, 7] })).toThrow(
      "1〜6列",
    );
    expect(() => parseChartCsv("x,y\n1," + "a".repeat(chartCsvLimits.maxBytes))).toThrow("1 MB");
    expect(() => parseChartCsv("x,y\n1," + "あ".repeat(340_000))).toThrow("1 MB");
  });
});
