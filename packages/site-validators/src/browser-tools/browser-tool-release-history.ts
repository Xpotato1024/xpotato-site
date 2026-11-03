import ts from 'typescript';
import {browserToolPinSchema,type BrowserToolPin} from '@xpotato/content-contracts';
/** Read the managed literal registry, never execute a caller-supplied factory. */
export function parseToolReleaseHistory(source:string):BrowserToolPin[]{
 const ast=ts.createSourceFile('releases.ts',source,ts.ScriptTarget.Latest,true);
 if((ast as unknown as {parseDiagnostics:readonly unknown[]}).parseDiagnostics.length)throw Error('Malformed release registry source');
 const imports=ast.statements.filter(ts.isImportDeclaration),statements=ast.statements.filter(s=>!ts.isImportDeclaration(s));
 const expected=new Map([['./generated/records.js','generatedReleases'],['@xpotato/content-contracts','BrowserToolPin']]);
 if(imports.length!==2||imports.some(i=>{
  if(!ts.isStringLiteral(i.moduleSpecifier))return true;
  const name=expected.get(i.moduleSpecifier.text),clause=i.importClause;
  if(!name||!clause||clause.name||!clause.namedBindings||!ts.isNamedImports(clause.namedBindings)||clause.namedBindings.elements.length!==1)return true;
  const item=clause.namedBindings.elements[0]!;return item.name.text!==name||Boolean(item.propertyName)||clause.isTypeOnly!==(name==='BrowserToolPin');
 })||new Set(imports.map(i=>(i.moduleSpecifier as ts.StringLiteral).text)).size!==2)throw Error('Historical registry imports differ');
 if(statements.length!==1||!ts.isVariableStatement(statements[0]!)||!statements[0].modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword))throw Error('Unique exported release registry required');
 const list=statements[0].declarationList;
 if(!(list.flags&ts.NodeFlags.Const)||list.declarations.length!==1)throw Error('Immutable release registry required');
 const declaration=list.declarations[0]!,call=declaration.initializer;
 if(!ts.isIdentifier(declaration.name)||declaration.name.text!=='browserToolReleases'||!call||!ts.isCallExpression(call)||call.questionDotToken||call.arguments.length!==1||call.typeArguments?.length
  ||!ts.isPropertyAccessExpression(call.expression)||call.expression.questionDotToken||!ts.isIdentifier(call.expression.expression)||call.expression.expression.text!=='Object'||call.expression.name.text!=='freeze')throw Error('Canonical Object.freeze registry initializer required');
 const array=call.arguments[0]!;
 if(!ts.isArrayLiteralExpression(array)||array.elements.filter(ts.isSpreadElement).length!==1||array.elements.filter(e=>ts.isSpreadElement(e)&&e.expression.getText(ast)==='generatedReleases').length!==1)throw Error('Historical release registry preimage differs');
 return array.elements.filter(e=>!ts.isSpreadElement(e)).map(e=>browserToolPinSchema.parse(JSON.parse(e.getText(ast))));
}
