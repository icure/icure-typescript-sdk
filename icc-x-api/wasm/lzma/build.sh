#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
XZ_VERSION="5.6.4"
XZ_TARBALL="xz-${XZ_VERSION}.tar.gz"
XZ_URL="https://github.com/tukaani-project/xz/releases/download/v${XZ_VERSION}/${XZ_TARBALL}"
XZ_SRC="$BUILD_DIR/xz-${XZ_VERSION}"

mkdir -p "$BUILD_DIR"

# Download xz source if not cached
if [ ! -d "$XZ_SRC" ]; then
    echo "Downloading xz ${XZ_VERSION}..."
    curl -sL "$XZ_URL" -o "$BUILD_DIR/$XZ_TARBALL"
    tar xzf "$BUILD_DIR/$XZ_TARBALL" -C "$BUILD_DIR"
    rm "$BUILD_DIR/$XZ_TARBALL"
fi

# Generate config.h via emconfigure if not already done
if [ ! -f "$XZ_SRC/config.h" ]; then
    echo "Running emconfigure ./configure..."
    cd "$XZ_SRC"
    emconfigure ./configure \
        --disable-threads \
        --disable-shared \
        --disable-xz \
        --disable-xzdec \
        --disable-lzmadec \
        --disable-lzmainfo \
        --disable-scripts \
        --disable-doc \
        --disable-nls \
        --host=wasm32-unknown-emscripten \
        > /dev/null 2>&1
    cd "$SCRIPT_DIR"
fi

# Collect the C source files needed for liblzma compression and decompression.
# We need: common, check, lzma (encoder+decoder), lz, rangecoder, simple, delta
LIBLZMA="$XZ_SRC/src/liblzma"
COMMON_SRC="$XZ_SRC/src/common"

C_FILES=(
    "$SCRIPT_DIR/lzma_wasm.c"

    # liblzma common
    "$LIBLZMA/common/common.c"
    "$LIBLZMA/common/block_util.c"
    "$LIBLZMA/common/block_encoder.c"
    "$LIBLZMA/common/block_decoder.c"
    "$LIBLZMA/common/block_header_encoder.c"
    "$LIBLZMA/common/block_header_decoder.c"
    "$LIBLZMA/common/block_buffer_encoder.c"
    "$LIBLZMA/common/block_buffer_decoder.c"
    "$LIBLZMA/common/easy_buffer_encoder.c"
    "$LIBLZMA/common/easy_encoder.c"
    "$LIBLZMA/common/easy_encoder_memusage.c"
    "$LIBLZMA/common/easy_preset.c"
    "$LIBLZMA/common/easy_decoder_memusage.c"
    "$LIBLZMA/common/filter_common.c"
    "$LIBLZMA/common/filter_encoder.c"
    "$LIBLZMA/common/filter_decoder.c"
    "$LIBLZMA/common/filter_flags_encoder.c"
    "$LIBLZMA/common/filter_flags_decoder.c"
    "$LIBLZMA/common/index.c"
    "$LIBLZMA/common/index_encoder.c"
    "$LIBLZMA/common/index_decoder.c"
    "$LIBLZMA/common/index_hash.c"
    "$LIBLZMA/common/stream_encoder.c"
    "$LIBLZMA/common/stream_decoder.c"
    "$LIBLZMA/common/stream_buffer_encoder.c"
    "$LIBLZMA/common/stream_buffer_decoder.c"
    "$LIBLZMA/common/stream_flags_common.c"
    "$LIBLZMA/common/stream_flags_encoder.c"
    "$LIBLZMA/common/stream_flags_decoder.c"
    "$LIBLZMA/common/vli_size.c"
    "$LIBLZMA/common/vli_encoder.c"
    "$LIBLZMA/common/vli_decoder.c"
    "$LIBLZMA/common/hardware_physmem.c"
    "$LIBLZMA/common/outqueue.c"

    # check
    "$LIBLZMA/check/check.c"
    "$LIBLZMA/check/crc32_table.c"
    "$LIBLZMA/check/crc32_fast.c"
    "$LIBLZMA/check/crc64_table.c"
    "$LIBLZMA/check/crc64_fast.c"
    "$LIBLZMA/check/sha256.c"

    # lzma encoder + decoder
    "$LIBLZMA/lzma/lzma_encoder.c"
    "$LIBLZMA/lzma/lzma_encoder_presets.c"
    "$LIBLZMA/lzma/lzma_encoder_optimum_fast.c"
    "$LIBLZMA/lzma/lzma_encoder_optimum_normal.c"
    "$LIBLZMA/lzma/lzma_decoder.c"
    "$LIBLZMA/lzma/lzma2_encoder.c"
    "$LIBLZMA/lzma/lzma2_decoder.c"
    "$LIBLZMA/lzma/fastpos_table.c"

    # lz
    "$LIBLZMA/lz/lz_encoder.c"
    "$LIBLZMA/lz/lz_encoder_mf.c"
    "$LIBLZMA/lz/lz_decoder.c"

    # rangecoder
    "$LIBLZMA/rangecoder/price_table.c"

    # simple filters (needed for filter_common)
    "$LIBLZMA/simple/simple_coder.c"
    "$LIBLZMA/simple/simple_encoder.c"
    "$LIBLZMA/simple/simple_decoder.c"
    "$LIBLZMA/simple/x86.c"
    "$LIBLZMA/simple/powerpc.c"
    "$LIBLZMA/simple/ia64.c"
    "$LIBLZMA/simple/arm.c"
    "$LIBLZMA/simple/armthumb.c"
    "$LIBLZMA/simple/arm64.c"
    "$LIBLZMA/simple/sparc.c"
    "$LIBLZMA/simple/riscv.c"

    # delta
    "$LIBLZMA/delta/delta_common.c"
    "$LIBLZMA/delta/delta_encoder.c"
    "$LIBLZMA/delta/delta_decoder.c"

    # tuklib common
    "$COMMON_SRC/tuklib_physmem.c"
)

INCLUDE_FLAGS=(
    "-I$XZ_SRC/src/liblzma/api"
    "-I$XZ_SRC/src/liblzma/common"
    "-I$XZ_SRC/src/liblzma/check"
    "-I$XZ_SRC/src/liblzma/lzma"
    "-I$XZ_SRC/src/liblzma/lz"
    "-I$XZ_SRC/src/liblzma/rangecoder"
    "-I$XZ_SRC/src/liblzma/simple"
    "-I$XZ_SRC/src/liblzma/delta"
    "-I$XZ_SRC/src/common"
    "-I$XZ_SRC/src"
)

echo "Compiling WASM module..."
emcc \
    -O3 \
    -s WASM=1 \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s EXPORTED_FUNCTIONS='["_lzma_wasm_compress","_lzma_wasm_decompress","_get_result_ptr","_get_result_len","_free_result","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","HEAPU8"]' \
    -s MODULARIZE=1 \
    -s EXPORT_NAME="createLzmaModule" \
    -s ENVIRONMENT='web,worker,node' \
    -s NO_FILESYSTEM=1 \
    -s SINGLE_FILE=0 \
    -DHAVE_CONFIG_H=1 \
    "-I$XZ_SRC" \
    "${INCLUDE_FLAGS[@]}" \
    "${C_FILES[@]}" \
    -o "$SCRIPT_DIR/lzma.js"

echo "Build complete:"
ls -lh "$SCRIPT_DIR/lzma.js" "$SCRIPT_DIR/lzma.wasm"