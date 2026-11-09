import { timingSafeEqual } from 'node:crypto';
export function tokenMatches(actual:string|undefined,expected:string|undefined){
 if(!actual||!expected)return false;const a=Buffer.from(actual),b=Buffer.from(`Bearer ${expected}`);return a.length===b.length&&timingSafeEqual(a,b);
}
