#include "avx_codec.h"
#include <string.h>

uint64_t avero_avx_hash(const uint8_t *data, size_t len) {
    uint64_t h = 1469598103934665603ULL;
    for (size_t i = 0; i < len; i++) {
        h ^= (uint64_t)data[i];
        h *= 1099511628211ULL;
    }
    return h;
}

int32_t avero_avx_validate(const uint8_t *data, size_t len) {
    if (data == 0 || len < 4) return 0;
    return (data[0] == 'A' && data[1] == 'V' && data[2] == 'X' && data[3] == '1') ? 1 : 0;
}

size_t avero_rle_encode(const uint8_t *src, size_t src_len, uint8_t *dst, size_t dst_cap) {
    if (!src || !dst || src_len == 0) return 0;
    size_t si = 0;
    size_t di = 0;
    while (si < src_len) {
        uint8_t v = src[si];
        size_t run = 1;
        while (si + run < src_len && src[si + run] == v && run < 255) run++;
        if (di + 2 > dst_cap) return 0;
        dst[di++] = (uint8_t)run;
        dst[di++] = v;
        si += run;
    }
    return di;
}

size_t avero_rle_decode(const uint8_t *src, size_t src_len, uint8_t *dst, size_t dst_cap) {
    if (!src || !dst || (src_len % 2) != 0) return 0;
    size_t di = 0;
    for (size_t i = 0; i + 1 < src_len; i += 2) {
        uint8_t run = src[i];
        uint8_t v = src[i + 1];
        if (run == 0) return 0;
        if (di + run > dst_cap) return 0;
        memset(dst + di, v, run);
        di += run;
    }
    return di;
}

const char *avero_avx_codec_name(void) { return "avero-avx-codec"; }
const char *avero_avx_codec_version(void) { return "1.0.0"; }
