#ifndef AVERO_AVX_CODEC_H
#define AVERO_AVX_CODEC_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* AVX container helpers. Magic bytes are "AVX1" at offset 0. */

/* FNV-1a 64-bit over raw bytes. */
uint64_t avero_avx_hash(const uint8_t *data, size_t len);

/* Returns 1 when buffer starts with AVX magic, else 0. */
int32_t avero_avx_validate(const uint8_t *data, size_t len);

/* Simple byte RLE for mask and alpha runs.
 * Returns encoded length, or 0 when dst is too small. */
size_t avero_rle_encode(const uint8_t *src, size_t src_len, uint8_t *dst, size_t dst_cap);
size_t avero_rle_decode(const uint8_t *src, size_t src_len, uint8_t *dst, size_t dst_cap);

const char *avero_avx_codec_name(void);
const char *avero_avx_codec_version(void);

#ifdef __cplusplus
}
#endif

#endif
