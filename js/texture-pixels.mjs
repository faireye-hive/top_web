const clamp=value=>Math.max(0,Math.min(255,value));
export function adjustTexturePixels(image,{brightness=1,contrast=1,saturation=1,sharpness=0}={}){
  const {data,width,height}=image;
  for(let i=0;i<data.length;i+=4){
    const gray=data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722;
    for(let channel=0;channel<3;channel++)data[i+channel]=clamp(((gray+(data[i+channel]-gray)*saturation)-127.5)*contrast*brightness+127.5*brightness);
  }
  if(sharpness>0){
    const source=new Uint8ClampedArray(data);
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
      const at=(y*width+x)*4;if(!source[at+3])continue;
      for(let c=0;c<3;c++){
        const neighbors=[at-4,at+4,at-width*4,at+width*4].filter(n=>source[n+3]>0);
        if(!neighbors.length)continue;
        const average=neighbors.reduce((sum,n)=>sum+source[n+c],0)/(neighbors.length||1);
        data[at+c]=clamp(source[at+c]+(source[at+c]-average)*sharpness);
      }
    }
  }
  return image;
}
export function textureOutputSize(width,height,limit=0){
  const side=limit||Math.min(2048,Math.max(width,height)),ratio=side/Math.max(width,height);
  return {width:Math.max(1,Math.round(width*ratio)),height:Math.max(1,Math.round(height*ratio))};
}
