#include "filters.hpp"
#include "image_ops.h"

#include <cmath>
#include <cstring>
#include <vector>
#include <algorithm>
#include <random>

namespace avero {

static inline uint8_t clamp_u8(int v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return static_cast<uint8_t>(v);
}
static inline int idx(int x, int y, int w) { return (y * w + x) * 4; }

void box_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius) {
    if (w <= 0 || h <= 0) return;
    if (radius <= 0) { std::memcpy(dst, src, static_cast<size_t>(w)*h*4); return; }
    std::vector<uint8_t> tmp(static_cast<size_t>(w)*h*4);
    const int r = radius; const int win = 2*r+1;
    for (int y=0;y<h;++y) for (int c=0;c<3;++c){
        int sum=0; for (int x=-r;x<=r;++x){ int xx=std::min(w-1,std::max(0,x)); sum+=src[idx(xx,y,w)+c];}
        for (int x=0;x<w;++x){ tmp[idx(x,y,w)+c]=static_cast<uint8_t>(sum/win);
            int xOut=std::min(w-1,std::max(0,x-r)), xIn=std::min(w-1,std::max(0,x+r+1));
            sum+=src[idx(xIn,y,w)+c]-src[idx(xOut,y,w)+c];}
        for (int x=0;x<w;++x) tmp[idx(x,y,w)+3]=src[idx(x,y,w)+3];
    }
    for (int x=0;x<w;++x) for (int c=0;c<3;++c){
        int sum=0; for (int y=-r;y<=r;++y){ int yy=std::min(h-1,std::max(0,y)); sum+=tmp[idx(x,yy,w)+c];}
        for (int y=0;y<h;++y){ dst[idx(x,y,w)+c]=static_cast<uint8_t>(sum/win);
            int yOut=std::min(h-1,std::max(0,y-r)), yIn=std::min(h-1,std::max(0,y+r+1));
            sum+=tmp[idx(x,yIn,w)+c]-tmp[idx(x,yOut,w)+c];}
        for (int y=0;y<h;++y) dst[idx(x,y,w)+3]=tmp[idx(x,y,w)+3];
    }
}

void sharpen(const uint8_t *src, uint8_t *dst, int w, int h, float amount) {
    if (w<=0||h<=0) return;
    if (amount<=0){ std::memcpy(dst,src,static_cast<size_t>(w)*h*4); return;}
    float a=amount;
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        int i=idx(x,y,w), xm=idx(std::max(0,x-1),y,w), xp=idx(std::min(w-1,x+1),y,w);
        int ym=idx(x,std::max(0,y-1),w), yp=idx(x,std::min(h-1,y+1),w);
        for (int c=0;c<3;++c){ float v=(1+4*a)*src[i+c]-a*(src[xm+c]+src[xp+c]+src[ym+c]+src[yp+c]); dst[i+c]=clamp_u8(int(v+0.5f));}
        dst[i+3]=src[i+3];
    }
}

void unsharp_mask(const uint8_t *src, uint8_t *dst, int w, int h, float amount, int radius) {
    if (w<=0||h<=0) return;
    std::vector<uint8_t> bl(static_cast<size_t>(w)*h*4);
    box_blur(src,bl.data(),w,h,radius<1?1:radius);
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        int i=idx(x,y,w);
        for (int c=0;c<3;++c){ int v=int(src[i+c]+amount*(src[i+c]-bl[i+c])+0.5f); dst[i+c]=clamp_u8(v);}
        dst[i+3]=src[i+3];
    }
}

void emboss(const uint8_t *src, uint8_t *dst, int w, int h) {
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        int i=idx(x,y,w), xm=idx(std::max(0,x-1),y,w), yp=idx(x,std::min(h-1,y+1),w);
        for (int c=0;c<3;++c) dst[i+c]=clamp_u8(128+int(src[yp+c])-int(src[xm+c]));
        dst[i+3]=src[i+3];
    }
}

void motion_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius, float angle_deg) {
    if (w<=0||h<=0) return; if (radius<1) radius=1;
    float rad=angle_deg*3.14159265f/180, dx=std::cos(rad), dy=std::sin(rad), inv=1.0f/radius;
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        float r=0,g=0,b=0; for (int k=0;k<radius;++k){ float off=k-radius*0.5f;
            int sx=int(std::lround(x+dx*off)), sy=int(std::lround(y+dy*off));
            sx=std::min(w-1,std::max(0,sx)); sy=std::min(h-1,std::max(0,sy));
            int si=idx(sx,sy,w); r+=src[si]; g+=src[si+1]; b+=src[si+2];}
        int i=idx(x,y,w); dst[i]=clamp_u8(int(r*inv+0.5f)); dst[i+1]=clamp_u8(int(g*inv+0.5f)); dst[i+2]=clamp_u8(int(b*inv+0.5f)); dst[i+3]=src[i+3];
    }
}

void gaussian(const uint8_t *src, uint8_t *dst, int w, int h, float sigma) {
    if (w<=0||h<=0) return;
    if (sigma<=0.1f){ std::memcpy(dst,src,static_cast<size_t>(w)*h*4); return;}
    int radius = int(std::ceil(sigma*3)); if (radius<1) radius=1; if (radius>32) radius=32;
    std::vector<float> kernel(2*radius+1);
    float sum=0; for (int i=-radius;i<=radius;++i){ float v=std::exp(-(i*i)/(2*sigma*sigma)); kernel[i+radius]=v; sum+=v; }
    for (float &v: kernel) v/=sum;
    std::vector<uint8_t> tmp(static_cast<size_t>(w)*h*4);
    for (int y=0;y<h;++y) for (int x=0;x<w;++x) for (int c=0;c<4;++c){
        float acc=0; for (int k=-radius;k<=radius;++k){ int xx=std::min(w-1,std::max(0,x+k)); acc+=src[idx(xx,y,w)+c]*kernel[k+radius];}
        tmp[idx(x,y,w)+c]=clamp_u8(int(acc+0.5f));
    }
    for (int y=0;y<h;++y) for (int x=0;x<w;++x) for (int c=0;c<4;++c){
        float acc=0; for (int k=-radius;k<=radius;++k){ int yy=std::min(h-1,std::max(0,y+k)); acc+=tmp[idx(x,yy,w)+c]*kernel[k+radius];}
        dst[idx(x,y,w)+c]=clamp_u8(int(acc+0.5f));
    }
}

void median(const uint8_t *src, uint8_t *dst, int w, int h, int radius) {
    if (radius<=0){ std::memcpy(dst,src,static_cast<size_t>(w)*h*4); return;}
    std::vector<uint8_t> win; win.reserve((2*radius+1)*(2*radius+1));
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        for (int c=0;c<3;++c){
            win.clear();
            for (int dy=-radius;dy<=radius;++dy) for (int dx=-radius;dx<=radius;++dx){
                int sx=std::min(w-1,std::max(0,x+dx)), sy=std::min(h-1,std::max(0,y+dy));
                win.push_back(src[idx(sx,sy,w)+c]);
            }
            std::nth_element(win.begin(), win.begin()+win.size()/2, win.end());
            dst[idx(x,y,w)+c]=win[win.size()/2];
        }
        dst[idx(x,y,w)+3]=src[idx(x,y,w)+3];
    }
}

void sobel(const uint8_t *src, uint8_t *dst, int w, int h) {
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        int gxR=0, gyR=0, gxG=0, gyG=0, gxB=0, gyB=0;
        auto at=[&](int dx,int dy,int c)->int{ int sx=std::min(w-1,std::max(0,x+dx)), sy=std::min(h-1,std::max(0,y+dy)); return src[idx(sx,sy,w)+c];};
        const int kx[3][3]={{-1,0,1},{-2,0,2},{-1,0,1}}, ky[3][3]={{-1,-2,-1},{0,0,0},{1,2,1}};
        for (int dy=-1;dy<=1;++dy) for (int dx=-1;dx<=1;++dx){
            gxR+=at(dx,dy,0)*kx[dy+1][dx+1]; gyR+=at(dx,dy,0)*ky[dy+1][dx+1];
            gxG+=at(dx,dy,1)*kx[dy+1][dx+1]; gyG+=at(dx,dy,1)*ky[dy+1][dx+1];
            gxB+=at(dx,dy,2)*kx[dy+1][dx+1]; gyB+=at(dx,dy,2)*ky[dy+1][dx+1];
        }
        int r=int(std::sqrt(float(gxR*gxR+gyR*gyR))+0.5f), g=int(std::sqrt(float(gxG*gxG+gyG*gyG))+0.5f), b=int(std::sqrt(float(gxB*gxB+gyB*gyB))+0.5f);
        int i=idx(x,y,w); dst[i]=clamp_u8(r); dst[i+1]=clamp_u8(g); dst[i+2]=clamp_u8(b); dst[i+3]=src[i+3];
    }
}

void vignette(uint8_t *src, uint8_t *dst, int w, int h, float amount) {
    if (amount<=0){ std::memcpy(dst,src,static_cast<size_t>(w)*h*4); return;}
    float cx=w*0.5f, cy=h*0.5f, maxd=std::sqrt(cx*cx+cy*cy);
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        float dx=x-cx, dy=y-cy, d=std::sqrt(dx*dx+dy*dy)/maxd, factor=1.0f - d*amount*0.9f;
        if (factor<0) factor=0;
        int i=idx(x,y,w);
        for (int c=0;c<3;++c) dst[i+c]=clamp_u8(int(src[i+c]*factor+0.5f));
        dst[i+3]=src[i+3];
    }
}

void chroma(const uint8_t *src, uint8_t *dst, int w, int h, int amount) {
    std::memcpy(dst,src,static_cast<size_t>(w)*h*4);
    if (amount<=0) return;
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        int i=idx(x,y,w);
        int rx=std::min(w-1,std::max(0,x+amount)), bx=std::min(w-1,std::max(0,x-amount));
        dst[i]=src[idx(rx,y,w)]; dst[i+2]=src[idx(bx,y,w)+2];
    }
}

void grain(uint8_t *src, uint8_t *dst, int w, int h, int amount, uint32_t seed) {
    if (amount<=0){ std::memcpy(dst,src,static_cast<size_t>(w)*h*4); return;}
    std::mt19937 rng(seed); std::uniform_int_distribution<int> dist(-amount, amount);
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        int i=idx(x,y,w); int n=dist(rng);
        for (int c=0;c<3;++c) dst[i+c]=clamp_u8(int(src[i+c])+n);
        dst[i+3]=src[i+3];
    }
}

void halftone(const uint8_t *src, uint8_t *dst, int w, int h, int size) {
    if (size<2) size=2;
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        int gridX=(x/size)*size, gridY=(y/size)*size;
        int sum=0, cnt=0;
        for (int dy=0;dy<size;++dy) for (int dx=0;dx<size;++dx){ int sx=gridX+dx, sy=gridY+dy; if (sx<w&&sy<h){ int si=idx(sx,sy,w); sum+=(src[si]+src[si+1]+src[si+2])/3; ++cnt;}}
        int avg=cnt?sum/cnt:128;
        float radius=(1.0f-avg/255.0f)*size*0.5f, dist=std::sqrt(float((x-gridX-size/2)*(x-gridX-size/2)+(y-gridY-size/2)*(y-gridY-size/2)));
        uint8_t v=dist<=radius?0:255;
        int i=idx(x,y,w); dst[i]=v; dst[i+1]=v; dst[i+2]=v; dst[i+3]=src[i+3];
    }
}

void tilt_shift(const uint8_t *src, uint8_t *dst, int w, int h, float blur, int focus_y, int focus_h) {
    int r=int(blur+0.5f); if (r<1) r=1;
    std::vector<uint8_t> bl(static_cast<size_t>(w)*h*4);
    box_blur(src,bl.data(),w,h,r);
    std::memcpy(dst,src,static_cast<size_t>(w)*h*4);
    for (int y=0;y<h;++y){
        int distY= std::abs(y-focus_y);
        float blend = distY < focus_h/2 ? 0.0f : std::min(1.0f, float(distY - focus_h/2)/float(focus_h));
        // smoothstep
        blend = blend*blend*(3-2*blend);
        for (int x=0;x<w;++x){ int i=idx(x,y,w);
            for (int c=0;c<3;++c) dst[i+c]=clamp_u8(int(src[i+c]*(1-blend)+bl[i+c]*blend+0.5f));}
    }
}

void oil_paint(const uint8_t *src, uint8_t *dst, int w, int h, int radius, int intensity) {
    if (radius<1) radius=1; if (intensity<1) intensity=1;
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){
        int histR[256]={0}, histG[256]={0}, histB[256]={0};
        int cnt=0;
        for (int dy=-radius;dy<=radius;++dy) for (int dx=-radius;dx<=radius;++dx){
            int sx=std::min(w-1,std::max(0,x+dx)), sy=std::min(h-1,std::max(0,y+dy));
            int si=idx(sx,sy,w);
            int qr=src[si]/intensity, qg=src[si+1]/intensity, qb=src[si+2]/intensity;
            histR[qr]++; histG[qg]++; histB[qb]++; ++cnt;
        }
        int bestR=0, bestG=0, bestB=0, mx=0;
        for (int i=0;i<256;++i) if (histR[i]>mx){mx=histR[i]; bestR=i;}
        mx=0; for (int i=0;i<256;++i) if (histG[i]>mx){mx=histG[i]; bestG=i;}
        mx=0; for (int i=0;i<256;++i) if (histB[i]>mx){mx=histB[i]; bestB=i;}
        int i=idx(x,y,w); dst[i]=clamp_u8(bestR*intensity); dst[i+1]=clamp_u8(bestG*intensity); dst[i+2]=clamp_u8(bestB*intensity); dst[i+3]=src[i+3];
    }
}

void find_edges(const uint8_t *src, uint8_t *dst, int w, int h) {
    sobel(src, dst, w, h);
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){ int i=idx(x,y,w); uint8_t v=255- (dst[i]+dst[i+1]+dst[i+2])/3; dst[i]=v; dst[i+1]=v; dst[i+2]=v; }
}

void pixelate(const uint8_t *src, uint8_t *dst, int w, int h, int size) {
    if (size<2) size=2;
    for (int y=0;y<h;++y) for (int x=0;x<w;++x){ int bx=(x/size)*size, by=(y/size)*size; int si=idx(bx,by,w), di=idx(x,y,w); dst[di]=src[si]; dst[di+1]=src[si+1]; dst[di+2]=src[si+2]; dst[di+3]=src[si+3];}
}

} // namespace avero

extern "C" {

void avero_cpp_box_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius){ avero::box_blur(src,dst,w,h,radius);}
void avero_cpp_sharpen(const uint8_t *src, uint8_t *dst, int w, int h, float amount){ avero::sharpen(src,dst,w,h,amount);}
void avero_cpp_unsharp(const uint8_t *src, uint8_t *dst, int w, int h, float amount, int radius){ avero::unsharp_mask(src,dst,w,h,amount,radius);}
void avero_cpp_emboss(const uint8_t *src, uint8_t *dst, int w, int h){ avero::emboss(src,dst,w,h);}
void avero_cpp_motion_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius, float angle_deg){ avero::motion_blur(src,dst,w,h,radius,angle_deg);}
void avero_cpp_gaussian(const uint8_t *src, uint8_t *dst, int w, int h, float sigma){ avero::gaussian(src,dst,w,h,sigma);}
void avero_cpp_median(const uint8_t *src, uint8_t *dst, int w, int h, int radius){ avero::median(src,dst,w,h,radius);}
void avero_cpp_sobel(const uint8_t *src, uint8_t *dst, int w, int h){ avero::sobel(src,dst,w,h);}
void avero_cpp_vignette(uint8_t *src, uint8_t *dst, int w, int h, float amount){ avero::vignette(src,dst,w,h,amount);}
void avero_cpp_chroma(const uint8_t *src, uint8_t *dst, int w, int h, int amount){ avero::chroma(src,dst,w,h,amount);}
void avero_cpp_grain(uint8_t *src, uint8_t *dst, int w, int h, int amount, uint32_t seed){ avero::grain(src,dst,w,h,amount,seed);}
void avero_cpp_halftone(const uint8_t *src, uint8_t *dst, int w, int h, int size){ avero::halftone(src,dst,w,h,size);}
void avero_cpp_tilt_shift(const uint8_t *src, uint8_t *dst, int w, int h, float blur, int focus_y, int focus_h){ avero::tilt_shift(src,dst,w,h,blur,focus_y,focus_h);}
void avero_cpp_oil_paint(const uint8_t *src, uint8_t *dst, int w, int h, int radius, int intensity){ avero::oil_paint(src,dst,w,h,radius,intensity);}
void avero_cpp_find_edges(const uint8_t *src, uint8_t *dst, int w, int h){ avero::find_edges(src,dst,w,h);}
void avero_cpp_pixelate(const uint8_t *src, uint8_t *dst, int w, int h, int size){ avero::pixelate(src,dst,w,h,size);}
const char *avero_cpp_engine_name(void){ return "AVERO C++ filters v2";}
const char *avero_cpp_version(void){ return "2.0.0";}

} // extern "C"
