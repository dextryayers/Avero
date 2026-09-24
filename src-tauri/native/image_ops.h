#ifndef AVERO_IMAGE_OPS_H
#define AVERO_IMAGE_OPS_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Operasi in-place RGBA8. len = w*h*4 harus kelipatan 4. */

/* Basis (6) */
void avero_c_gray(uint8_t *rgba, size_t len);
void avero_c_invert(uint8_t *rgba, size_t len);
void avero_c_brightness(uint8_t *rgba, size_t len, int32_t amount);
void avero_c_contrast(uint8_t *rgba, size_t len, int32_t amount);
void avero_c_threshold(uint8_t *rgba, size_t len, int32_t level);
void avero_c_desaturate(uint8_t *rgba, size_t len, int32_t amount);

/* Level lanjut (12) */
void avero_c_exposure(uint8_t *rgba, size_t len, float ev);
void avero_c_gamma(uint8_t *rgba, size_t len, float gamma);
void avero_c_vibrance(uint8_t *rgba, size_t len, int32_t amount);
void avero_c_warmth(uint8_t *rgba, size_t len, int32_t warmth);
void avero_c_posterize(uint8_t *rgba, size_t len, int32_t levels);
void avero_c_sepia(uint8_t *rgba, size_t len, int32_t amount);
void avero_c_color_balance(uint8_t *rgba, size_t len, int32_t cr, int32_t mg, int32_t yb);
void avero_c_shadows_highlights(uint8_t *rgba, size_t len, int32_t shadows, int32_t highlights);
void avero_c_hue_shift(uint8_t *rgba, size_t len, int32_t hue_deg);
void avero_c_auto_levels(uint8_t *rgba, size_t len);
void avero_c_auto_contrast(uint8_t *rgba, size_t len);
void avero_c_opacity(uint8_t *rgba, size_t len, int32_t opacity);

/* Advance ringan RAM: hanya 256-entry LUT atau histogram, tanpa alokasi gambar kedua */
void avero_c_lut_map(uint8_t *rgba, size_t len, const uint8_t lut_r[256], const uint8_t lut_g[256], const uint8_t lut_b[256]);
void avero_c_equalize(uint8_t *rgba, size_t len);
void avero_c_dither_floyd(uint8_t *rgba, size_t w, size_t h);
void avero_c_noise_mono(uint8_t *rgba, size_t len, int32_t amount, uint32_t seed);
void avero_c_channel_swap(uint8_t *rgba, size_t len, int32_t mode);
void avero_c_alpha_premultiply(uint8_t *rgba, size_t len);

const char *avero_c_engine_name(void);
const char *avero_c_version(void);

#ifdef __cplusplus
}
#endif

#endif
