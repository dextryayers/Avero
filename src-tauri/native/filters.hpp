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
void avero_cpp_gaussian(const uint8_t *src, uint8_t *dst, int w, int h, float sigma);
void avero_cpp_median(const uint8_t *src, uint8_t *dst, int w, int h, int radius);
void avero_cpp_sobel(const uint8_t *src, uint8_t *dst, int w, int h);
void avero_cpp_vignette(uint8_t *src, uint8_t *dst, int w, int h, float amount);
void avero_cpp_chroma(const uint8_t *src, uint8_t *dst, int w, int h, int amount);
void avero_cpp_grain(uint8_t *src, uint8_t *dst, int w, int h, int amount, uint32_t seed);
void avero_cpp_halftone(const uint8_t *src, uint8_t *dst, int w, int h, int size);
void avero_cpp_tilt_shift(const uint8_t *src, uint8_t *dst, int w, int h, float blur, int focus_y, int focus_h);
void avero_cpp_oil_paint(const uint8_t *src, uint8_t *dst, int w, int h, int radius, int intensity);
void avero_cpp_find_edges(const uint8_t *src, uint8_t *dst, int w, int h);
void avero_cpp_pixelate(const uint8_t *src, uint8_t *dst, int w, int h, int size);
const char *avero_cpp_engine_name(void);
const char *avero_cpp_version(void);

} // extern "C"

namespace avero {

void box_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius);
void sharpen(const uint8_t *src, uint8_t *dst, int w, int h, float amount);
void unsharp_mask(const uint8_t *src, uint8_t *dst, int w, int h, float amount, int radius);
void emboss(const uint8_t *src, uint8_t *dst, int w, int h);
void motion_blur(const uint8_t *src, uint8_t *dst, int w, int h, int radius, float angle_deg);
void gaussian(const uint8_t *src, uint8_t *dst, int w, int h, float sigma);
void median(const uint8_t *src, uint8_t *dst, int w, int h, int radius);
void sobel(const uint8_t *src, uint8_t *dst, int w, int h);
void vignette(uint8_t *src, uint8_t *dst, int w, int h, float amount);
void chroma(const uint8_t *src, uint8_t *dst, int w, int h, int amount);
void grain(uint8_t *src, uint8_t *dst, int w, int h, int amount, uint32_t seed);
void halftone(const uint8_t *src, uint8_t *dst, int w, int h, int size);
void tilt_shift(const uint8_t *src, uint8_t *dst, int w, int h, float blur, int focus_y, int focus_h);
void oil_paint(const uint8_t *src, uint8_t *dst, int w, int h, int radius, int intensity);
void find_edges(const uint8_t *src, uint8_t *dst, int w, int h);
void pixelate(const uint8_t *src, uint8_t *dst, int w, int h, int size);

} // namespace avero

#endif
