#include <lzma.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten/emscripten.h>

/* Result buffer shared between calls — caller must copy before next call. */
static uint8_t *result_buf = NULL;
static size_t result_len = 0;

EMSCRIPTEN_KEEPALIVE
size_t get_result_len(void) {
    return result_len;
}

EMSCRIPTEN_KEEPALIVE
uint8_t *get_result_ptr(void) {
    return result_buf;
}

EMSCRIPTEN_KEEPALIVE
void free_result(void) {
    free(result_buf);
    result_buf = NULL;
    result_len = 0;
}

/*
 * Compress `input` (length `input_len`) using LZMA2 in the .xz container format.
 * `preset` maps to liblzma presets (0-9, 6 is default).
 * Returns 0 on success, non-zero on error.
 * After success, call get_result_ptr() / get_result_len() to read the output.
 */
EMSCRIPTEN_KEEPALIVE
int lzma_wasm_compress(const uint8_t *input, size_t input_len, uint32_t preset) {
    free_result();

    /* Worst-case: compressed can be larger than input. Allocate generously. */
    size_t out_capacity = input_len + input_len / 3 + 256;
    result_buf = (uint8_t *)malloc(out_capacity);
    if (!result_buf) return 1;

    size_t out_pos = 0;
    lzma_ret ret = lzma_easy_buffer_encode(
        preset, LZMA_CHECK_CRC64,
        NULL, /* allocator */
        input, input_len,
        result_buf, &out_pos, out_capacity
    );

    if (ret != LZMA_OK) {
        free_result();
        return (int)ret;
    }

    result_len = out_pos;
    return 0;
}

/*
 * Decompress .xz data.
 * Returns 0 on success, non-zero on error.
 */
EMSCRIPTEN_KEEPALIVE
int lzma_wasm_decompress(const uint8_t *input, size_t input_len) {
    free_result();

    /* Start with 4x input as estimate, grow if needed. */
    size_t out_capacity = input_len * 4;
    if (out_capacity < 1024) out_capacity = 1024;

    lzma_stream strm = LZMA_STREAM_INIT;
    lzma_ret ret = lzma_stream_decoder(&strm, UINT64_MAX, 0);
    if (ret != LZMA_OK) return (int)ret;

    result_buf = (uint8_t *)malloc(out_capacity);
    if (!result_buf) {
        lzma_end(&strm);
        return 1;
    }

    strm.next_in = input;
    strm.avail_in = input_len;
    strm.next_out = result_buf;
    strm.avail_out = out_capacity;

    while (1) {
        ret = lzma_code(&strm, LZMA_FINISH);
        if (ret == LZMA_STREAM_END) {
            break;
        }
        if (ret == LZMA_OK && strm.avail_out == 0) {
            /* Need more output space — double the buffer. */
            size_t used = out_capacity - strm.avail_out;
            out_capacity *= 2;
            uint8_t *tmp = (uint8_t *)realloc(result_buf, out_capacity);
            if (!tmp) {
                lzma_end(&strm);
                free_result();
                return 1;
            }
            result_buf = tmp;
            strm.next_out = result_buf + used;
            strm.avail_out = out_capacity - used;
            continue;
        }
        if (ret != LZMA_OK) {
            lzma_end(&strm);
            free_result();
            return (int)ret;
        }
    }

    result_len = strm.total_out;
    lzma_end(&strm);
    return 0;
}