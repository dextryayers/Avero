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

const char *avero_c_engine_name(void);
const char *avero_c_version(void);

#ifdef __cplusplus
}
#endif

#endif
