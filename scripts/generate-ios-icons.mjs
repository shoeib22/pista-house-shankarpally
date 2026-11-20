import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
const root=fileURLToPath(new URL('../',import.meta.url));
const logo=await fs.readFile(path.join(root,'docs/design/pista-house-official-logo.svg'),'utf8');
const inner=logo.slice(logo.indexOf('>')+1,logo.lastIndexOf('</svg>'));
for(const [role,label] of [['customer','CUSTOMER'],['delivery','DELIVERY'],['owner','OWNER']]){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs><clipPath id="pistaBadgeClip"><rect width="164" height="48"/></clipPath></defs><rect width="1024" height="1024" fill="#F7F3E9"/><rect x="72" y="72" width="880" height="880" rx="100" fill="#FFFEFA" stroke="#B59A5B" stroke-width="5"/><g transform="translate(112 215) scale(4.87804878)"><g clip-path="url(#pistaBadgeClip)">${inner}</g></g><text x="512" y="610" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="69" font-weight="700" letter-spacing="7" fill="#17613B">${label}</text><path d="M350 680H674" stroke="#B59A5B" stroke-width="5"/><text x="512" y="785" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="38" letter-spacing="6" fill="#17613B">SHANKARPALLY</text><text x="512" y="868" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="29" letter-spacing="5" fill="#6E765F">BETA TEST</text></svg>`;
 const directory=path.join(root,`apps/${role}_app/ios/Runner/Assets.xcassets/AppIcon.appiconset`);
 const contents=JSON.parse(await fs.readFile(path.join(directory,'Contents.json'),'utf8'));
 for(const item of contents.images){const size=Math.round(Number(item.size.split('x')[0])*Number(item.scale.replace('x','')));const target=path.join(directory,item.filename);await sharp(Buffer.from(svg)).resize(size,size).flatten({background:'#F7F3E9'}).removeAlpha().png().toFile(target);const metadata=await sharp(target).metadata();if(metadata.width!==size||metadata.height!==size||metadata.hasAlpha)throw new Error('Icon encoding check failed');}
 console.log(`${role}: official vector badge rendered into opaque iOS icon sizes`);
}
