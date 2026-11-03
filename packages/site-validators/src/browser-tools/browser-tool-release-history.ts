import ts from 'typescript';
import {browserToolPinSchema,type BrowserToolPin} from '@xpotato/content-contracts';
export function parseToolReleaseHistory(source:string){
 const ast=ts.createSourceFile('releases.ts',source,ts.ScriptTarget.Latest,true);let pins:BrowserToolPin[]|undefined;
 function visit(node:ts.Node){
  if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='browserToolReleases'&&node.initializer){
   const array=ts.isCallExpression(node.initializer)?node.initializer.arguments[0]:node.initializer;
   if(pins||!array||!ts.isArrayLiteralExpression(array)||array.elements.filter(e=>ts.isSpreadElement(e)&&e.expression.getText(ast)==='generatedReleases').length!==1)throw Error('Historical release registry preimage differs');
   pins=array.elements.filter(e=>!ts.isSpreadElement(e)).map(e=>browserToolPinSchema.parse(JSON.parse(e.getText(ast))));
  }ts.forEachChild(node,visit);
 }visit(ast);if(!pins)throw Error('Historical release registry preimage differs');return pins;
}

