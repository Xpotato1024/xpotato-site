# Compiler runtime notices
Compiler image: emscripten/emsdk 4.0.15, digest
27bc6267cb285223b8aebb7627bfebae7cb3ad2aaa0d5923b8aa5321793033e8.

The compiled WASM links Emscripten standalone runtime/emmalloc, musl libc/math,
and compiler-rt support. Relevant license texts were copied from that image:
- [Emscripten MIT / NCSA](EMSCRIPTEN-LICENSE.txt)
- [musl copyright and terms](MUSL-COPYRIGHT.txt)
- [compiler-rt license](COMPILER-RT-LICENSE.txt)

emmalloc.c notice: Copyright 2018 The Emscripten Authors. All rights reserved.
Emscripten is available under the MIT license and the University of
Illinois/NCSA Open Source License in the linked LICENSE text.
No runtime is fetched by the browser. Our application's private UNLICENSED
status is unchanged.
