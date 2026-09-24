#ifndef AVERO_FILTERS_HPP
#define AVERO_FILTERS_HPP

#include <cstdint>
#include <cstddef>

/* C wrappers (link stabil dari Rust) */
extern "C" {

void avero_cpp_box_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius);
void avero_cpp_sharpen(const uint8_t *src, uint8_t *dst, int w, int h, float amount);
void avero_cpp_unsharp(const uint8_t *src, uint8_t *dst, int w, int h, float amount, int radius);
void avero_cpp_emboss(const uint8_t *src, uint8_t *dst, int w, int h);
void avero_cpp_motion_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius, float angle_deg);
const char *avero_cpp_engine_name(void);

} // extern "C"

namespace avero {

void box_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius);
void sharpen(const uint8_t *src, uint8_t *dst, int w, int h, float amount);
void unsharp_mask(const uint8_t *src, uint8_t *dst, int w, int h, float amount, int radius);
void emboss(const uint8_t *src, uint8_t *dst, int w, int h);
void motion_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius, float angle_deg);

} // namespace avero

#endif
