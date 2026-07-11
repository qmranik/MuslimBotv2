import 'package:flutter/material.dart';

/// Placeholder surface for tiers/features that land in a later phase, so the
/// navigation is complete and honest about what's wired vs. pending.
class ComingSoon extends StatelessWidget {
  final String title;
  final String phase;
  final String description;
  final IconData icon;

  const ComingSoon({
    super.key,
    required this.title,
    required this.phase,
    required this.description,
    this.icon = Icons.construction_rounded,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 56, color: Theme.of(context).hintColor),
              const SizedBox(height: 16),
              Text(title,
                  style: Theme.of(context)
                      .textTheme
                      .titleLarge
                      ?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 6),
              Chip(label: Text('Arriving in $phase')),
              const SizedBox(height: 12),
              Text(description,
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Theme.of(context).hintColor)),
            ],
          ),
        ),
      ),
    );
  }
}
