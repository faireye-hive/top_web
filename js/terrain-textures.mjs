export const TERRAIN_ATLAS={columns:8,cell:256,padding:2,repeat:4};
export function writeTerrainUV(out,offset,tile,x,z,cornerX=0,cornerZ=0){
  const id=Number.isInteger(tile)&&tile>=0&&tile<64?tile:0;
  // Wrap the tile origin only. Wrapping the far vertex folds every fourth
  // quad back across three quarters of the image and visibly stretches it.
  const u=((x%4)+4)%4+cornerX,v=((z%4)+4)%4+cornerZ;
  out[offset]=(id%8+(2+u*63)/256)/8;out[offset+1]=1-(Math.floor(id/8)+(2+v*63)/256)/8;
}
export function terrainAtlasUV(...args){const out=[];writeTerrainUV(out,0,...args);return out;}
export function paintAtlasCell(ctx,image,tile,cell=256){
  const pad=cell/128,inner=cell-2*pad,x=tile%8*cell,y=Math.floor(tile/8)*cell;
  ctx.drawImage(image,0,0,image.width,image.height,x+pad,y+pad,inner,inner);
  ctx.drawImage(image,0,0,1,image.height,x,y+pad,pad,inner);
  ctx.drawImage(image,image.width-1,0,1,image.height,x+cell-pad,y+pad,pad,inner);
  ctx.drawImage(image,0,0,image.width,1,x,y,cell,pad);
  ctx.drawImage(image,0,image.height-1,image.width,1,x,y+cell-pad,cell,pad);
}
