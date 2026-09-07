#pragma once

#ifdef __cplusplus
extern "C" {
#endif

const char* torreplo_core_version();
char* torreplo_parse_magnet(const char* input);
void torreplo_free_string(char* value);

#ifdef __cplusplus
}
#endif
