#include "torreplo_core.h"

#include <algorithm>
#include <cctype>
#include <cstdlib>
#include <cstring>
#include <sstream>
#include <string>
#include <vector>

namespace {

std::string decode_component(const std::string& value) {
  std::string output;
  output.reserve(value.size());

  for (std::size_t i = 0; i < value.size(); ++i) {
    if (value[i] == '%' && i + 2 < value.size()) {
      auto hex = [](char c) -> int {
        if (c >= '0' && c <= '9') return c - '0';
        if (c >= 'a' && c <= 'f') return c - 'a' + 10;
        if (c >= 'A' && c <= 'F') return c - 'A' + 10;
        return -1;
      };

      const int high = hex(value[i + 1]);
      const int low = hex(value[i + 2]);
      if (high >= 0 && low >= 0) {
        output.push_back(static_cast<char>((high << 4) | low));
        i += 2;
        continue;
      }
    }

    output.push_back(value[i] == '+' ? ' ' : value[i]);
  }

  return output;
}

std::string json_escape(const std::string& value) {
  std::ostringstream out;
  for (const unsigned char c : value) {
    switch (c) {
      case '\\': out << "\\\\"; break;
      case '"': out << "\\\""; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default:
        if (c < 0x20) {
          const char* hex = "0123456789abcdef";
          out << "\\u00" << hex[(c >> 4) & 0x0f] << hex[c & 0x0f];
        } else {
          out << static_cast<char>(c);
        }
    }
  }
  return out.str();
}

bool valid_btih(std::string value) {
  if (value.size() == 40) {
    return std::all_of(value.begin(), value.end(), [](unsigned char c) { return std::isxdigit(c) != 0; });
  }
  if (value.size() == 32) {
    return std::all_of(value.begin(), value.end(), [](unsigned char c) {
      c = static_cast<unsigned char>(std::toupper(c));
      return (c >= 'A' && c <= 'Z') || (c >= '2' && c <= '7');
    });
  }
  return false;
}

char* duplicate_string(const std::string& value) {
  auto* result = static_cast<char*>(std::malloc(value.size() + 1));
  if (!result) return nullptr;
  std::memcpy(result, value.c_str(), value.size() + 1);
  return result;
}

}  // namespace

const char* torreplo_core_version() {
  return "torreplo-core/0.1.0 (C++17)";
}

char* torreplo_parse_magnet(const char* input) {
  if (!input) return duplicate_string("{\"error\":\"Magnet input is null\"}");

  const std::string magnet(input);
  const std::string prefix = "magnet:?";
  if (magnet.rfind(prefix, 0) != 0) {
    return duplicate_string("{\"error\":\"Input is not a magnet URI\"}");
  }

  std::string info_hash;
  std::string display_name;
  std::vector<std::string> trackers;

  std::stringstream query(magnet.substr(prefix.size()));
  std::string pair;
  while (std::getline(query, pair, '&')) {
    const auto separator = pair.find('=');
    const std::string key = decode_component(pair.substr(0, separator));
    const std::string value = separator == std::string::npos ? "" : decode_component(pair.substr(separator + 1));

    if (key == "xt" && value.rfind("urn:btih:", 0) == 0 && info_hash.empty()) {
      info_hash = value.substr(9);
    } else if (key == "dn" && display_name.empty()) {
      display_name = value;
    } else if (key == "tr" && !value.empty()) {
      trackers.push_back(value);
    }
  }

  if (!valid_btih(info_hash)) {
    return duplicate_string("{\"error\":\"Magnet URI is missing a valid BitTorrent info hash\"}");
  }

  std::transform(info_hash.begin(), info_hash.end(), info_hash.begin(), [](unsigned char c) {
    return static_cast<char>(std::tolower(c));
  });

  std::ostringstream json;
  json << "{\"info_hash\":\"" << json_escape(info_hash) << "\",\"display_name\":";
  if (display_name.empty()) json << "null";
  else json << "\"" << json_escape(display_name) << "\"";
  json << ",\"trackers\":[";
  for (std::size_t i = 0; i < trackers.size(); ++i) {
    if (i > 0) json << ',';
    json << "\"" << json_escape(trackers[i]) << "\"";
  }
  json << "]}";

  return duplicate_string(json.str());
}

void torreplo_free_string(char* value) {
  std::free(value);
}
