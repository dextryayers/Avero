#include "image_ops.h"
#include <math.h>
#include <string.h>

static inline uint8_t clamp_u8(int32_t v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return (uint8_t)v;
}
static inline uint8_t clamp_f(float v) {
    if (v < 0.0f) return 0;
    if (v > 255.0f) return 255;
    return (uint8_t)(v + 0.5f);
}

/* --- Basis --- */

void avero_c_gray(uint8_t *rgba, size_t len) {
    for (size_t i = 0; i + 3 < len; i += 4) {
        int32_t y = (int32_t)(0.299f * rgba[i] + 0.587f * rgba[i + 1] + 0.114f * rgba[i + 2] + 0.5f);
        uint8_t g = clamp_u8(y);
        rgba[i] = g; rgba[i + 1] = g; rgba[i + 2] = g;
    }
}

void avero_c_invert(uint8_t *rgba, size_t len) {
    for (size_t i = 0; i + 3 < len; i += 4) {
        rgba[i] = (uint8_t)(255 - rgba[i]);
        rgba[i + 1] = (uint8_t)(255 - rgba[i + 1]);
        rgba[i + 2] = (uint8_t)(255 - rgba[i + 2]);
    }
}

void avero_c_brightness(uint8_t *rgba, size_t len, int32_t amount) {
    int32_t shift = amount * 2;
    for (size_t i = 0; i + 3 < len; i += 4) {
        rgba[i] = clamp_u8((int32_t)rgba[i] + shift);
        rgba[i + 1] = clamp_u8((int32_t)rgba[i + 1] + shift);
        rgba[i + 2] = clamp_u8((int32_t)rgba[i + 2] + shift);
    }
}

void avero_c_contrast(uint8_t *rgba, size_t len, int32_t amount) {
    float f = ((float)(amount + 100)) / 100.0f;
    if (f < 0.01f) f = 0.01f;
    int32_t c = 128;
    for (size_t i = 0; i + 3 < len; i += 4) {
        rgba[i] = clamp_u8((int32_t)(f * ((int32_t)rgba[i] - c) + c));
        rgba[i + 1] = clamp_u8((int32_t)(f * ((int32_t)rgba[i + 1] - c) + c));
        rgba[i + 2] = clamp_u8((int32_t)(f * ((int32_t)rgba[i + 2] - c) + c));
    }
}

void avero_c_threshold(uint8_t *rgba, size_t len, int32_t level) {
    if (level < 0) level = 0; if (level > 255) level = 255;
    for (size_t i = 0; i + 3 < len; i += 4) {
        int32_t y = (int32_t)(0.299f * rgba[i] + 0.587f * rgba[i + 1] + 0.114f * rgba[i + 2] + 0.5f);
        uint8_t v = (y >= level) ? 255 : 0;
        rgba[i] = v; rgba[i + 1] = v; rgba[i + 2] = v;
    }
}

void avero_c_desaturate(uint8_t *rgba, size_t len, int32_t amount) {
    if (amount < 0) amount = 0; if (amount > 100) amount = 100;
    float a = (float)amount / 100.0f;
    for (size_t i = 0; i + 3 < len; i += 4) {
        float y = 0.299f * rgba[i] + 0.587f * rgba[i + 1] + 0.114f * rgba[i + 2];
        rgba[i] = clamp_u8((int32_t)(rgba[i] + (y - rgba[i]) * a + 0.5f));
        rgba[i + 1] = clamp_u8((int32_t)(rgba[i + 1] + (y - rgba[i + 1]) * a + 0.5f));
        rgba[i + 2] = clamp_u8((int32_t)(rgba[i + 2] + (y - rgba[i + 2]) * a + 0.5f));
    }
}

/* --- Lanjut --- */

void avero_c_exposure(uint8_t *rgba, size_t len, float ev) {
    if (ev < -6.0f) ev = -6.0f; if (ev > 6.0f) ev = 6.0f;
    float g = powf(2.0f, ev);
    for (size_t i = 0; i + 3 < len; i += 4) {
        rgba[i] = clamp_f(rgba[i] * g);
        rgba[i + 1] = clamp_f(rgba[i + 1] * g);
        rgba[i + 2] = clamp_f(rgba[i + 2] * g);
    }
}

void avero_c_gamma(uint8_t *rgba, size_t len, float gamma) {
    if (gamma < 0.1f) gamma = 0.1f; if (gamma > 4.0f) gamma = 4.0f;
    float inv = 1.0f / gamma;
    uint8_t lut[256];
    for (int i = 0; i < 256; ++i) lut[i] = clamp_f(255.0f * powf(i / 255.0f, inv));
    for (size_t i = 0; i + 3 < len; i += 4) {
        rgba[i] = lut[rgba[i]];
        rgba[i + 1] = lut[rgba[i + 1]];
        rgba[i + 2] = lut[rgba[i + 2]];
    }
}

void avero_c_vibrance(uint8_t *rgba, size_t len, int32_t amount) {
    if (amount < -100) amount = -100; if (amount > 100) amount = 100;
    float a = amount / 100.0f;
    for (size_t i = 0; i + 3 < len; i += 4) {
        uint8_t r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        uint8_t mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
        uint8_t mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
        float sat = mx == 0 ? 0.0f : (float)(mx - mn) / mx;
        float boost = (1.0f - sat) * a * 0.9f;
        if (boost < -0.9f) boost = -0.9f;
        float y = 0.299f * r + 0.587f * g + 0.114f * b;
        rgba[i] = clamp_f(r + (r - y) * boost);
        rgba[i + 1] = clamp_f(g + (g - y) * boost);
        rgba[i + 2] = clamp_f(b + (b - y) * boost);
    }
}

void avero_c_warmth(uint8_t *rgba, size_t len, int32_t warmth) {
    if (warmth < -100) warmth = -100; if (warmth > 100) warmth = 100;
    for (size_t i = 0; i + 3 < len; i += 4) {
        int32_t r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
        r = clamp_u8(r + warmth * 0.7f);
        b = clamp_u8(b - warmth * 0.7f);
        rgba[i] = (uint8_t)r; rgba[i + 1] = (uint8_t)g; rgba[i + 2] = (uint8_t)b;
    }
}

void avero_c_posterize(uint8_t *rgba, size_t len, int32_t levels) {
    if (levels < 2) levels = 2; if (levels > 32) levels = 32;
    float step = 255.0f / (levels - 1);
    for (size_t i = 0; i + 3 < len; i += 4) {
        rgba[i] = clamp_u8((int32_t)(roundf(rgba[i] / step) * step));
        rgba[i + 1] = clamp_u8((int32_t)(roundf(rgba[i + 1] / step) * step));
        rgba[i + 2] = clamp_u8((int32_t)(roundf(rgba[i + 2] / step) * step));
    }
}

void avero_c_sepia(uint8_t *rgba, size_t len, int32_t amount) {
    if (amount < 0) amount = 0; if (amount > 100) amount = 100;
    float a = amount / 100.0f, b = 1.0f - a;
    for (size_t i = 0; i + 3 < len; i += 4) {
        float r = rgba[i], g = rgba[i + 1], bl = rgba[i + 2];
        float sr = fminf(255.0f, r * 0.393f + g * 0.769f + bl * 0.189f);
        float sg = fminf(255.0f, r * 0.349f + g * 0.686f + bl * 0.168f);
        float sb = fminf(255.0f, r * 0.272f + g * 0.534f + bl * 0.131f);
        rgba[i] = clamp_f(r * b + sr * a);
        rgba[i + 1] = clamp_f(g * b + sg * a);
        rgba[i + 2] = clamp_f(bl * b + sb * a);
    }
}

void avero_c_color_balance(uint8_t *rgba, size_t len, int32_t cr, int32_t mg, int32_t yb) {
    if (cr < -100) cr = -100; if (cr > 100) cr = 100;
    if (mg < -100) mg = -100; if (mg > 100) mg = 100;
    if (yb < -100) yb = -100; if (yb > 100) yb = 100;
    for (size_t i = 0; i + 3 < len; i += 4) {
        rgba[i] = clamp_u8((int32_t)rgba[i] + cr);
        rgba[i + 1] = clamp_u8((int32_t)rgba[i + 1] + mg);
        rgba[i + 2] = clamp_u8((int32_t)rgba[i + 2] + yb);
    }
}

void avero_c_shadows_highlights(uint8_t *rgba, size_t len, int32_t shadows, int32_t highlights) {
    if (shadows < -100) shadows = -100; if (shadows > 100) shadows = 100;
    if (highlights < -100) highlights = -100; if (highlights > 100) highlights = 100;
    float s = shadows / 100.0f, h = highlights / 100.0f;
    for (size_t i = 0; i + 3 < len; i += 4) {
        for (int c = 0; c < 3; ++c) {
            float v = rgba[i + c] / 255.0f;
            if (v < 0.5f) v += s * (0.5f - v) * 0.8f;
            else v -= h * (v - 0.5f) * 0.8f;
            rgba[i + c] = clamp_f(v * 255.0f);
        }
    }
}

static void rgb_to_hsl(uint8_t r, uint8_t g, uint8_t b, float *hh, float *ss, float *ll) {
    float R = r / 255.0f, G = g / 255.0f, B = b / 255.0f;
    float mx = fmaxf(R, fmaxf(G, B)), mn = fminf(R, fminf(G, B));
    float h = 0, s = 0, l = (mx + mn) * 0.5f;
    if (mx != mn) {
        float d = mx - mn;
        s = l > 0.5f ? d / (2.0f - mx - mn) : d / (mx + mn);
        if (mx == R) h = (G - B) / d + (G < B ? 6.0f : 0.0f);
        else if (mx == G) h = (B - R) / d + 2.0f;
        else h = (R - G) / d + 4.0f;
        h /= 6.0f;
    }
    *hh = h; *ss = s; *ll = l;
}
static float hue2rgb(float p, float q, float t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1.0f/6) return p + (q - p) * 6 * t;
    if (t < 1.0f/2) return q;
    if (t < 2.0f/3) return p + (q - p) * (2.0f/3 - t) * 6;
    return p;
}
static void hsl_to_rgb(float h, float s, float l, uint8_t *r, uint8_t *g, uint8_t *b) {
    float R, G, B;
    if (s == 0) R = G = B = l;
    else {
        float q = l < 0.5f ? l * (1 + s) : l + s - l * s;
        float p = 2 * l - q;
        R = hue2rgb(p, q, h + 1.0f/3);
        G = hue2rgb(p, q, h);
        B = hue2rgb(p, q, h - 1.0f/3);
    }
    *r = clamp_f(R * 255); *g = clamp_f(G * 255); *b = clamp_f(B * 255);
}

void avero_c_hue_shift(uint8_t *rgba, size_t len, int32_t hue_deg) {
    float sh = fmodf(hue_deg / 360.0f, 1.0f);
    if (sh < 0) sh += 1.0f;
    for (size_t i = 0; i + 3 < len; i += 4) {
        float h, s, l;
        rgb_to_hsl(rgba[i], rgba[i + 1], rgba[i + 2], &h, &s, &l);
        h = fmodf(h + sh, 1.0f);
        uint8_t r, g, b;
        hsl_to_rgb(h, s, l, &r, &g, &b);
        rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b;
    }
}

void avero_c_auto_levels(uint8_t *rgba, size_t len) {
    if (len < 4) return;
    uint8_t mnR = 255, mxR = 0, mnG = 255, mxG = 0, mnB = 255, mxB = 0;
    for (size_t i = 0; i + 3 < len; i += 4) {
        if (rgba[i] < mnR) mnR = rgba[i]; if (rgba[i] > mxR) mxR = rgba[i];
        if (rgba[i + 1] < mnG) mnG = rgba[i + 1]; if (rgba[i + 1] > mxG) mxG = rgba[i + 1];
        if (rgba[i + 2] < mnB) mnB = rgba[i + 2]; if (rgba[i + 2] > mxB) mxB = rgba[i + 2];
    }
    float sR = mxR > mnR ? 255.0f / (mxR - mnR) : 1.0f;
    float sG = mxG > mnG ? 255.0f / (mxG - mnG) : 1.0f;
    float sB = mxB > mnB ? 255.0f / (mxB - mnB) : 1.0f;
    for (size_t i = 0; i + 3 < len; i += 4) {
        rgba[i] = clamp_f((rgba[i] - mnR) * sR);
        rgba[i + 1] = clamp_f((rgba[i + 1] - mnG) * sG);
        rgba[i + 2] = clamp_f((rgba[i + 2] - mnB) * sB);
    }
}

void avero_c_auto_contrast(uint8_t *rgba, size_t len) {
    if (len < 4) return;
    uint8_t mn = 255, mx = 0;
    for (size_t i = 0; i + 3 < len; i += 4) {
        uint8_t y = (uint8_t)(0.299f * rgba[i] + 0.587f * rgba[i + 1] + 0.114f * rgba[i + 2] + 0.5f);
        if (y < mn) mn = y; if (y > mx) mx = y;
    }
    if (mx <= mn) return;
    float s = 255.0f / (mx - mn);
    for (size_t i = 0; i + 3 < len; i += 4) {
        for (int c = 0; c < 3; ++c) rgba[i + c] = clamp_f((rgba[i + c] - mn) * s);
    }
}

void avero_c_opacity(uint8_t *rgba, size_t len, int32_t opacity) {
    if (opacity < 0) opacity = 0; if (opacity > 100) opacity = 100;
    for (size_t i = 0; i + 3 < len; i += 4) rgba[i + 3] = (uint8_t)(rgba[i + 3] * opacity / 100);
}

/* --- Advance ringan RAM --- */

void avero_c_lut_map(uint8_t *rgba, size_t len, const uint8_t lut_r[256], const uint8_t lut_g[256], const uint8_t lut_b[256]) {
    for (size_t i = 0; i + 3 < len; i += 4) { rgba[i] = lut_r[rgba[i]]; rgba[i + 1] = lut_g[rgba[i + 1]]; rgba[i + 2] = lut_b[rgba[i + 2]]; }
}

void avero_c_equalize(uint8_t *rgba, size_t len) {
    if (len < 4) return;
    int hist[256] = {0};
    for (size_t i = 0; i + 3 < len; i += 4) { uint8_t y = (uint8_t)(0.299f * rgba[i] + 0.587f * rgba[i + 1] + 0.114f * rgba[i + 2] + 0.5f); hist[y]++; }
    int cdf[256]; cdf[0] = hist[0]; for (int i = 1; i < 256; ++i) cdf[i] = cdf[i - 1] + hist[i];
    int total = (int)(len / 4); int cdf_min = 0; for (int i = 0; i < 256; ++i) if (cdf[i] != 0) { cdf_min = cdf[i]; break; }
    uint8_t lut[256]; for (int i = 0; i < 256; ++i) lut[i] = clamp_u8((int)(((float)(cdf[i] - cdf_min) / (total - cdf_min)) * 255 + 0.5f));
    for (size_t i = 0; i + 3 < len; i += 4) { uint8_t y = (uint8_t)(0.299f * rgba[i] + 0.587f * rgba[i + 1] + 0.114f * rgba[i + 2] + 0.5f); uint8_t e = lut[y]; float r = rgba[i] - y; rgba[i] = clamp_f(e + r); r = rgba[i + 1] - y; rgba[i + 1] = clamp_f(e + r); r = rgba[i + 2] - y; rgba[i + 2] = clamp_f(e + r); }
}

void avero_c_dither_floyd(uint8_t *rgba, size_t w, size_t h) {
    if (w == 0 || h == 0) return;
    for (size_t y = 0; y < h; ++y) for (size_t x = 0; x < w; ++x) {
        size_t i = (y * w + x) * 4;
        for (int c = 0; c < 3; ++c) { uint8_t old = rgba[i + c]; uint8_t ne = old < 128 ? 0 : 255; rgba[i + c] = ne; int16_t err = (int16_t)old - (int16_t)ne; if (x + 1 < w) rgba[i + 4 + c] = clamp_u8((int)rgba[i + 4 + c] + err * 7 / 16); if (y + 1 < h) { if (x > 0) rgba[(y + 1) * w * 4 + (x - 1) * 4 + c] = clamp_u8((int)rgba[(y + 1) * w * 4 + (x - 1) * 4 + c] + err * 3 / 16); rgba[(y + 1) * w * 4 + x * 4 + c] = clamp_u8((int)rgba[(y + 1) * w * 4 + x * 4 + c] + err * 5 / 16); if (x + 1 < w) rgba[(y + 1) * w * 4 + (x + 1) * 4 + c] = clamp_u8((int)rgba[(y + 1) * w * 4 + (x + 1) * 4 + c] + err * 1 / 16); } }
    }
}

void avero_c_noise_mono(uint8_t *rgba, size_t len, int32_t amount, uint32_t seed) {
    if (amount <= 0) return; if (amount > 64) amount = 64;
    uint32_t s = seed ? seed : 1;
    for (size_t i = 0; i + 3 < len; i += 4) { s = s * 1664525u + 1013904223u; int32_t n = ((int32_t)(s >> 16) % (amount * 2 + 1)) - amount; rgba[i] = clamp_u8((int32_t)rgba[i] + n); rgba[i + 1] = clamp_u8((int32_t)rgba[i + 1] + n); rgba[i + 2] = clamp_u8((int32_t)rgba[i + 2] + n); }
}

void avero_c_channel_swap(uint8_t *rgba, size_t len, int32_t mode) {
    for (size_t i = 0; i + 3 < len; i += 4) { uint8_t r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]; switch (mode % 6) { case 1: rgba[i] = g; rgba[i + 1] = b; rgba[i + 2] = r; break; case 2: rgba[i] = b; rgba[i + 1] = r; rgba[i + 2] = g; break; case 3: rgba[i] = g; rgba[i + 1] = r; rgba[i + 2] = b; break; case 4: rgba[i] = b; rgba[i + 1] = g; rgba[i + 2] = r; break; case 5: rgba[i] = r; rgba[i + 1] = b; rgba[i + 2] = g; break; default: break; } }
}

void avero_c_alpha_premultiply(uint8_t *rgba, size_t len) {
    for (size_t i = 0; i + 3 < len; i += 4) { float a = rgba[i + 3] / 255.0f; rgba[i] = clamp_f(rgba[i] * a); rgba[i + 1] = clamp_f(rgba[i + 1] * a); rgba[i + 2] = clamp_f(rgba[i + 2] * a); }
}

const char *avero_c_engine_name(void) { return "AVERO C core v2"; }
const char *avero_c_version(void) { return "2.0.0"; }
