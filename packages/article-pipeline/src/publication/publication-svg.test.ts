import {it,expect} from 'vitest';import {assertStaticPublicationSvg} from './publication-svg.js';
const svg=(body:string,extra='')=>'<svg xmlns="http://www.w3.org/2000/svg" '+extra+' viewBox="0 0 16 16" width="16" height="16">'+body+'</svg>';
it('accepts static outlined shapes and same-document clip/gradient references',()=>{
 expect(()=>assertStaticPublicationSvg(svg('<title>Test &amp; static</title><defs><clipPath id="clip"><rect width="16" height="16"/></clipPath></defs><g clip-path="url(#clip)"><path fill="#fff" d="M0 0H16V16Z"/></g>'))).not.toThrow();
});
it('rejects namespace script/foreign content, SMIL, CSS, event handlers, external refs and entity declarations',()=>{
 for(const body of ['<s:script>never execute</s:script>','<s:foreignObject/>','<animate attributeName="href"/>','<set/>','<style/>','<use href="#x"/>','<image/>','<rect onclick="never"/>',
  '<rect style="fill:red"/>','<rect fill="url(https://example.invalid/a)"/>','<rect fill="url(&#104;ttps://example.invalid/a)"/>','<rect evil:fill="red" xmlns:evil="https://example.invalid/"/>']){
  expect(()=>assertStaticPublicationSvg(svg(body,'xmlns:s="http://www.w3.org/2000/svg"'))).toThrow('SVG');
 }
 for(const source of ['<!DOCTYPE svg [<!ENTITY x "no">]>'+svg('<title>&x;</title>'),'<?xml-stylesheet href="remote"?>'+svg(''),svg('<g>')])expect(()=>assertStaticPublicationSvg(source)).toThrow();
});
