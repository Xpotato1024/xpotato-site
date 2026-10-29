export interface SocialTitleOptions { lines?: readonly string[]; width?: number; height?: number; lineHeight?: number; minSize?: number; maxSize?: number; maxLines?: number }
export interface SocialTitleLayout { title:string; lines:string[]; fontSize:number; lineHeight:number; mode:'manual'|'automatic' }
export function layoutSocialTitle(title:string,options:SocialTitleOptions,measure:(text:string,size:number)=>number):SocialTitleLayout;
