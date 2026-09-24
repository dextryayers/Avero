#ifndef AVERO_IMAGE_OPS_H
#define AVERO_IMAGE_OPS_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Semua operasi in-place pada buffer RGBA8 (len harus kelipatan 4). */
void avero_c_gray(uint8_t *rgba, size_t len);
void avero_c_invert(uint8_t *rgba, size_t len);
void avero_c_brightness(uint8_t *rgba, size_t len, int32_t amount);
void avero_c_contrast(uint8_t *rgba, size_t len, int32_t amount);
void avero_c_threshold(uint8_t *rgba, size_t len, int32_t level);
void avero_c_desaturate(uint8_t *rgba, size_t len, int32_t amount);

const char *avero_c_engine_name(void);

#ifdef __cplusplus
}
#endif

#endif
