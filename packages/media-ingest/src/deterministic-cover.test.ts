import {describe,it,expect} from "vitest";
import {resolve} from "node:path";
import sharp from "sharp";
import {deterministicCover} from "./deterministic-cover.js";
const input={repositoryRoot:resolve("."),title:"手書きの記事と、根拠・画像を確かめる",categoryLabel:"ソフトウェア",pubDate:"2026-10-15"};
describe("pinned outline cover",()=>{
 it("repeats exact SVG and raster bytes, with Japanese outlines and no text/fallback/external references",async()=>{
  const a=await deterministicCover(input),b=await deterministicCover(input);
  expect(a.hero.equals(b.hero)).toBe(true);expect(a.derivationSha256).toBe(b.derivationSha256);
  expect(a.hero.toString()).not.toMatch(/<text\b|<image\b|<use\b|href=|url\(/u);
  expect(a.hero.toString()).toContain("<path");expect(a.binding.layout.lines.join("")).toBe(input.title);
  const hero=await sharp(a.hero).webp({lossless:true,effort:6}).toBuffer();
  expect(hero.equals(await sharp(b.hero).webp({lossless:true,effort:6}).toBuffer())).toBe(true);
  const meta=await sharp(hero).metadata();expect(meta).toMatchObject({width:2400,height:1260,space:"srgb"});
  expect(meta.exif).toBeUndefined();expect(meta.xmp).toBeUndefined();
  expect(await sharp(a.social).metadata()).toMatchObject({width:1200,height:630});
 },30000);
 it("changes derivation with title or category, retains every character in fitted lines",async()=>{
  const a=await deterministicCover(input),b=await deterministicCover({...input,title:input.title+"。"});
  expect(a.derivationSha256).not.toBe(b.derivationSha256);
  const long=await deterministicCover({...input,title:"日本語の記事を読みやすくする設計と検証".repeat(4)});
  expect(long.binding.layout.lines.join("")).toBe("日本語の記事を読みやすくする設計と検証".repeat(4));
  expect(long.binding.layout.fontSize).toBeGreaterThanOrEqual(44);
 });
 it.each(["絵文字 🫠","不可視\u200b文字","\u0000危険","長".repeat(181)])("refuses unsupported or overflowing title %s",async(title)=>{
  await expect(deterministicCover({...input,title})).rejects.toThrow(/^COVER_/u);
 });
});
