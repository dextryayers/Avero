#include "filters.hpp"
#include "image_ops.h"

#include <cmath>
#include <cstring>
#include <vector>
#include <algorithm>

namespace avero {

static inline uint8_t clamp_u8(int v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return static_cast<uint8_t>(v);
}

static inline int idx(int x, int y, int w) {
    return (y * w + x) * 4;
}

void box_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius) {
    if (w <= 0 || h <= 0) return;
    if (radius <= 0) {
        std::memcpy(dst, src, static_cast<size_t>(w) * static_cast<size_t>(h) * 4);
        return;
    }
    std::vector<uint8_t> tmp(static_cast<size_t>(w) * static_cast<size_t>(h) * 4);
    const int r = radius;
    const int window = 2 * r + 1;

    for (int y = 0; y < h; ++y) {
        for (int c = 0; c < 3; ++c) {
            int sum = 0;
            for (int x = -r; x <= r; ++x) {
                int xx = std::min(w - 1, std::max(0, x));
                sum += src[idx(xx, y, w) + c];
            }
            for (int x = 0; x < w; ++x) {
                tmp[idx(x, y, w) + c] = static_cast<uint8_t>(sum / window);
                int xOut = std::min(w - 1, std::max(0, x - r));
                int xIn = std::min(w - 1, std::max(0, x + r + 1));
                sum += src[idx(xIn, y, w) + c] - src[idx(xOut, y, w) + c];
            }
            for (int x = 0; x < w; ++x) {
                tmp[idx(x, y, w) + 3] = src[idx(x, y, w) + 3];
            }
        }
    }

    for (int x = 0; x < w; ++x) {
        for (int c = 0; c < 3; ++c) {
            int sum = 0;
            for (int y = -r; y <= r; ++y) {
                int yy = std::min(h - 1, std::max(0, y));
                sum += tmp[idx(x, yy, w) + c];
            }
            for (int y = 0; y < h; ++y) {
                dst[idx(x, y, w) + c] = static_cast<uint8_t>(sum / window);
                int yOut = std::min(h - 1, std::max(0, y - r));
                int yIn = std::min(h - 1, std::max(0, y + r + 1));
                sum += tmp[idx(x, yIn, w) + c] - tmp[idx(x, yOut, w) + c];
            }
            for (int y = 0; y < h; ++y) {
                dst[idx(x, y, w) + 3] = tmp[idx(x, y, w) + 3];
            }
        }
    }
}

void sharpen(const uint8_t *src, uint8_t *dst, int w, int h, float amount) {
    if (w <= 0 || h <= 0) return;
    if (amount <= 0.0f) {
        std::memcpy(dst, src, static_cast<size_t>(w) * static_cast<size_t>(h) * 4);
        return;
    }
    const float a = amount;
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            const int i = idx(x, y, w);
            const int xm = idx(std::max(0, x - 1), y, w);
            const int xp = idx(std::min(w - 1, x + 1), y, w);
            const int ym = idx(x, std::max(0, y - 1), w);
            const int yp = idx(x, std::min(h - 1, y + 1), w);
            for (int c = 0; c < 3; ++c) {
                float v = (1.0f + 4.0f * a) * static_cast<float>(src[i + c])
                        - a * (static_cast<float>(src[xm + c]) + static_cast<float>(src[xp + c])
                             + static_cast<float>(src[ym + c]) + static_cast<float>(src[yp + c]));
                dst[i + c] = clamp_u8(static_cast<int>(v + 0.5f));
            }
            dst[i + 3] = src[i + 3];
        }
    }
}

void unsharp_mask(const uint8_t *src, uint8_t *dst, int w, int h, float amount, int radius) {
    if (w <= 0 || h <= 0) return;
    std::vector<uint8_t> blurred(static_cast<size_t>(w) * static_cast<size_t>(h) * 4);
    box_blur(src, blurred.data(), w, h, radius < 1 ? 1 : radius);
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            const int i = idx(x, y, w);
            for (int c = 0; c < 3; ++c) {
                int v = static_cast<int>(src[i + c]
                    + amount * (static_cast<float>(src[i + c]) - static_cast<float>(blurred[i + c]))
                    + 0.5f);
                dst[i + c] = clamp_u8(v);
            }
            dst[i + 3] = src[i + 3];
        }
    }
}

void emboss(const uint8_t *src, uint8_t *dst, int w, int h) {
    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            const int i = idx(x, y, w);
            const int xm = idx(std::max(0, x - 1), y, w);
            const int yp = idx(x, std::min(h - 1, y + 1), w);
            for (int c = 0; c < 3; ++c) {
                int v = 128 + (static_cast<int>(src[yp + c]) - static_cast<int>(src[xm + c]));
                dst[i + c] = clamp_u8(v);
            }
            dst[i + 3] = src[i + 3];
        }
    }
}

void motion_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius, float angle_deg) {
    if (w <= 0 || h <= 0) return;
    if (radius < 1) radius = 1;
    const float rad = angle_deg * 3.14159265358979f / 180.0f;
    const float dx = std::cos(rad);
    const float dy = std::sin(rad);
    const float inv = 1.0f / static_cast<float>(radius);

    for (int y = 0; y < h; ++y) {
        for (int x = 0; x < w; ++x) {
            float r = 0, g = 0, b = 0;
            for (int k = 0; k < radius; ++k) {
                float off = static_cast<float>(k) - radius * 0.5f;
                int sx = static_cast<int>(std::lround(static_cast<float>(x) + dx * off));
                int sy = static_cast<int>(std::lround(static_cast<float>(y) + dy * off));
                if (sx < 0) sx = 0;
                if (sy < 0) sy = 0;
                if (sx >= w) sx = w - 1;
                if (sy >= h) sy = h - 1;
                const int si = idx(sx, sy, w);
                r += static_cast<float>(src[si]);
                g += static_cast<float>(src[si + 1]);
                b += static_cast<float>(src[si + 2]);
            }
            const int i = idx(x, y, w);
            dst[i] = clamp_u8(static_cast<int>(r * inv + 0.5f));
            dst[i + 1] = clamp_u8(static_cast<int>(g * inv + 0.5f));
            dst[i + 2] = clamp_u8(static_cast<int>(b * inv + 0.5f));
            dst[i + 3] = src[i + 3];
        }
    }
}

} // namespace avero

extern "C" {

void avero_cpp_box_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius) {
    avero::box_blur(src, dst, w, h, radius);
}
void avero_cpp_sharpen(const uint8_t *src, uint8_t *dst, int w, int h, float amount) {
    avero::sharpen(src, dst, w, h, amount);
}
void avero_cpp_unsharp(const uint8_t *src, uint8_t *dst, int w, int h, float amount, int radius) {
    avero::unsharp_mask(src, dst, w, h, amount, radius);
}
void avero_cpp_emboss(const uint8_t *src, uint8_t *dst, int w, int h) {
    avero::emboss(src, dst, w, h);
}
void avero_cpp_motion_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius, float angle_deg) {
    avero::motion_blur(src, dst, w, h, radius, angle_deg);
}
const char *avero_cpp_engine_name(void) {
    return avero_c_engine_name();
}

} // extern "C"
