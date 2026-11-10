import 'package:flutter/material.dart';

import '../../dung_chung/tien_ich/dinh_dang.dart';
import '../../dung_chung/giao_dien/chu_de.dart';

class PremiumBanner extends StatelessWidget {
  const PremiumBanner(
      {super.key,
      required this.price,
      required this.days,
      required this.onTap});

  final Object price;
  final int days;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final message = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Khai thác hạn mức CapitalFlow với Premium',
            style: AppText.body
                .copyWith(color: Colors.white, fontWeight: FontWeight.w600)),
        const SizedBox(height: Space.sm),
        DecoratedBox(
          decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(Radii.sm)),
          child: const Padding(
            padding:
                EdgeInsets.symmetric(horizontal: Space.sm, vertical: Space.xs),
            child: Text('Nâng cấp ngay',
                style: TextStyle(
                    color: AppColors.blueDark, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
    final offer = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text('Chỉ với',
            style: TextStyle(color: Colors.white, fontSize: 14)),
        const SizedBox(height: Space.xxs),
        Text('${editMoney(price)} ₫',
            style: moneyStyle.copyWith(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: const Color(0xFFFFEEA6))),
        if (days > 0)
          Text('$days ngày sử dụng',
              style: const TextStyle(color: Colors.white, fontSize: 12)),
      ],
    );
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.blueDark, AppColors.blue, Color(0xFF087CAF)],
          begin: Alignment.centerLeft,
          end: Alignment.topRight,
        ),
        borderRadius: BorderRadius.circular(Radii.md),
      ),
      child: Material(
        type: MaterialType.transparency,
        borderRadius: BorderRadius.circular(Radii.md),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(Space.md),
            child: LayoutBuilder(builder: (context, constraints) {
              if (constraints.maxWidth < 300 ||
                  MediaQuery.textScalerOf(context).scale(1) > 1.15) {
                return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      offer,
                      const SizedBox(height: Space.md),
                      message,
                    ]);
              }
              return Row(children: [
                Expanded(flex: 3, child: message),
                const SizedBox(width: Space.md),
                Expanded(flex: 2, child: offer),
              ]);
            }),
          ),
        ),
      ),
    );
  }
}
