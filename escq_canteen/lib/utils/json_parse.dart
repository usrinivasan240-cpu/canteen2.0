/// Parsers for JSON decoded by `dart:convert`, tolerant of the shapes the
/// Postgres driver can emit.
///
/// `pg` returns Postgres `bigint` (int8) columns as JSON *strings* to avoid
/// silent precision loss, so an epoch-ms `created_at` arrives as "1750000000000"
/// rather than 1750000000000. Casting such a value with `as num?` throws a
/// TypeError, and because model parsing happens inside a `.map()`, that single
/// throw discards every remaining record in the list — the screen then renders
/// its empty state even though the server returned rows.
///
/// Total by construction: never throws, so one malformed record cannot blank a
/// whole list.
library;

/// Reads [v] as an int, accepting num or String. Returns [fallback] for null
/// or unparseable input.
int asInt(dynamic v, [int fallback = 0]) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) {
    return int.tryParse(v) ?? double.tryParse(v)?.toInt() ?? fallback;
  }
  return fallback;
}

/// Reads [v] as an int, or null when absent/unparseable. Use where "no value" is
/// meaningfully different from zero (e.g. a missing timestamp).
int? asIntOrNull(dynamic v) {
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) {
    return int.tryParse(v) ?? double.tryParse(v)?.toInt();
  }
  return null;
}

/// Reads [v] as a double, accepting num or String. Returns [fallback] for null
/// or unparseable input.
double asDouble(dynamic v, [double fallback = 0]) {
  if (v is double) return v;
  if (v is num) return v.toDouble();
  if (v is String) {
    return double.tryParse(v) ?? fallback;
  }
  return fallback;
}

/// Reads [v] as a double, or null when absent/unparseable. Use where "no value"
/// is meaningfully different from zero (e.g. an absent wallet balance).
double? asDoubleOrNull(dynamic v) {
  if (v is double) return v;
  if (v is num) return v.toDouble();
  if (v is String) {
    return double.tryParse(v);
  }
  return null;
}
