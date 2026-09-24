#ifndef AVERO_FILTERS_HPP
#define AVERO_FILTERS_HPP

#include <cstdint>
#include <cstddef>

extern "C" {
/* dari image_ops.c */
const char *avero_c_engine_name(void);
}

namespace avero {

/* src dan dst buffer RGBA8 terpisah, ukuran w*h*4. */
void box_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius);
void sharpen(const uint8_t *src, uint8_t *dst, int w, int h, float amount);
void unsharp_mask(const uint8_t *src, uint8_t *dst, int w, int h, float amount, int radius);
void emboss(const uint8_t *src, uint8_t *dst, int w, int h);
void motion_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius, float angle_deg);

const char *engine_name();

} // namespace avero

#endif
