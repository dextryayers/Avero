#include "image_ops.h"

static inline uint8_t clamp_u8(int32_t v) {
    if (v < 0) return 0;
    if (v > 255) return 255;
    return (uint8_t)v;
}

void avero_c_gray(uint8_t *rgba, size_t len) {
    for (size_t i = 0; i + 3 < len; i += 4) {
        int32_t y = (int32_t)(0.299f * rgba[i] + 0.587f * rgba[i + 1] + 0.114f * rgba[i + 2] + 0.5f);
        uint8_t g = clamp_u8(y);
        rgba[i] = g;
        rgba[i + 1] = g;
        rgba[i + 2] = g;
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
    /* amount: -100..100 */
    int32_t shift = amount * 2;
    for (size_t i = 0; i + 3 < len; i += 4) {
        rgba[i] = clamp_u8((int32_t)rgba[i] + shift);
        rgba[i + 1] = clamp_u8((int32_t)rgba[i + 1] + shift);
        rgba[i + 2] = clamp_u8((int32_t)rgba[i + 2] + shift);
    }
}

void avero_c_contrast(uint8_t *rgba, size_t len, int32_t amount) {
    /* amount: -100..100 -> factor di sekitar 1.0 */
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
    int32_t t = level;
    if (t < 0) t = 0;
    if (t > 255) t = 255;
    for (size_t i = 0; i + 3 < len; i += 4) {
        int32_t y = (int32_t)(0.299f * rgba[i] + 0.587f * rgba[i + 1] + 0.114f * rgba[i + 2] + 0.5f);
        uint8_t v = (y >= t) ? 255 : 0;
        rgba[i] = v;
        rgba[i + 1] = v;
        rgba[i + 2] = v;
    }
}

void avero_c_desaturate(uint8_t *rgba, size_t len, int32_t amount) {
    /* amount: 0..100 */
    if (amount < 0) amount = 0;
    if (amount > 100) amount = 100;
    float a = (float)amount / 100.0f;
    for (size_t i = 0; i + 3 < len; i += 4) {
        float y = 0.299f * rgba[i] + 0.587f * rgba[i + 1] + 0.114f * rgba[i + 2];
        rgba[i] = clamp_u8((int32_t)(rgba[i] + (y - rgba[i]) * a + 0.5f));
        rgba[i + 1] = clamp_u8((int32_t)(rgba[i + 1] + (y - rgba[i + 1]) * a + 0.5f));
        rgba[i + 2] = clamp_u8((int32_t)(rgba[i + 2] + (y - rgba[i + 2]) * a + 0.5f));
    }
}

const char *avero_c_engine_name(void) {
    return "AVERO C core";
}
