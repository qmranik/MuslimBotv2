import 'package:intl/intl.dart';
import '../muslimbot/persona.dart';

/// Locale-aware formatting aligned to the MuslimBot persona (₹, Asia/Dhaka).
class Fmt {
  Fmt._();

  static final NumberFormat _money = NumberFormat.currency(
    symbol: MuslimBot.currencySymbol,
    decimalDigits: 2,
  );

  static final NumberFormat _compact = NumberFormat.compactCurrency(
    symbol: MuslimBot.currencySymbol,
  );

  static final DateFormat _shortDate = DateFormat('d MMM yyyy');
  static final DateFormat _dateTime = DateFormat('d MMM yyyy, h:mm a');

  /// `₹1,234.50` from a num or numeric string. Returns the raw string if it
  /// can't be parsed (some ERP fields arrive pre-formatted).
  static String money(Object? value) {
    final n = _toNum(value);
    if (n == null) return value?.toString() ?? '${MuslimBot.currencySymbol}0.00';
    return _money.format(n);
  }

  /// `₹1.2K` compact form for tight KPI tiles.
  static String moneyCompact(Object? value) {
    final n = _toNum(value);
    if (n == null) return value?.toString() ?? '${MuslimBot.currencySymbol}0';
    return _compact.format(n);
  }

  static String shortDate(Object? value) {
    final d = _toDate(value);
    return d == null ? (value?.toString() ?? '') : _shortDate.format(d);
  }

  static String dateTime(Object? value) {
    final d = _toDate(value);
    return d == null ? (value?.toString() ?? '') : _dateTime.format(d);
  }

  static num? _toNum(Object? v) {
    if (v == null) return null;
    if (v is num) return v;
    return num.tryParse(v.toString().replaceAll(RegExp(r'[^0-9.\-]'), ''));
  }

  static DateTime? _toDate(Object? v) {
    if (v == null) return null;
    if (v is DateTime) return v;
    return DateTime.tryParse(v.toString());
  }
}
