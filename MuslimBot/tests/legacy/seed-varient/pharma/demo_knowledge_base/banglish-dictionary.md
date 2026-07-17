# Banglish-to-English Dictionary & Voice Reference

This document enables the AI agent to understand Banglish (romanized Bangla) input from customers and staff, commonly used in voice orders.

## Medicine Name Mappings

| Banglish Input | Standard Name | Generic Name | Category |
|----------------|--------------|--------------|----------|
| napa | Napa 500mg | Paracetamol | Analgesic |
| napa extra | Napa Extra | Paracetamol + Caffeine | Analgesic |
| sergel | Sergel 20mg | Omeprazole | Antacid |
| seclo | Seclo 20mg | Omeprazole | Antacid |
| ace | ACE 250mg | Paracetamol | Analgesic |
| ace plus | ACE Plus | Paracetamol + Caffeine | Analgesic |
| amoxil | Amoxil 500mg | Amoxicillin | Antibiotic |
| zimax | Zimax 500mg | Azithromycin | Antibiotic |
| flixonase | Flixonase | Fluticasone | Nasal Spray |
| timonol | Timonol | Timolol | Eye Drops |
| losectil | Losectil 20mg | Omeprazole | Antacid |
| maxpro | Maxpro 20mg | Esomeprazole | Antacid |
| tycil | Tycil 500mg | Amoxicillin | Antibiotic |
| ciprocin | Ciprocin 500mg | Ciprofloxacin | Antibiotic |
| flagyl | Flagyl 400mg | Metronidazole | Antibiotic |
| pantonix | Pantonix 40mg | Pantoprazole | Antacid |
| orcef | Orcef 200mg | Cefixime | Antibiotic |
| montelukast / monas | Monas 10mg | Montelukast | Respiratory |
| salbutamol / sultolin | Sultolin Inhaler | Salbutamol | Respiratory |
| omeprazol | Seclo/Sergel 20mg | Omeprazole | Antacid |
| paracetamol | Napa/ACE | Paracetamol | Analgesic |
| vitamin c / ceevit | Ceevit 250mg | Ascorbic Acid | Vitamin |
| calcium / calbo | Calbo-D | Calcium + Vit D | Supplement |
| iron / ferosul | Ferosul | Ferrous Sulfate | Supplement |
| ranitidine / neotack | Neotack 150mg | Ranitidine | Antacid |
| amlodipine / amdocal | Amdocal 5mg | Amlodipine | Cardiac |
| losartan / angiazem | Angiazem 50mg | Losartan | Cardiac |
| metformin / comet | Comet 500mg | Metformin | Diabetes |
| atorvastatin / atorva | Atorva 10mg | Atorvastatin | Cholesterol |

## Grocery Item Mappings

| Banglish | Standard Name |
|----------|--------------|
| chawal | Rice (various) |
| dal | Lentils (various) |
| tel | Cooking Oil |
| holud | Turmeric Powder |
| morich | Chili Powder |
| sabun | Soap |
| shampoo | Shampoo |
| toothpaste | Toothpaste |
| dudh | Milk |
| pani | Water |

## Unit Conversions

| Banglish | English | Description |
|----------|---------|-------------|
| pata | strip | Blister strip of tablets |
| botal / bottle | bottle | Syrup or liquid bottle |
| ta / piece / pcs | piece | Individual item |
| box / baksho | box | Box/pack |
| tube | tube | Ointment/cream tube |
| packet / peket | packet | Sachet or packet |
| dozen | dozen | 12 pieces |
| hali | 4 pieces | Traditional count |
| kuri | 20 pieces | Traditional count |
| kg / kilo | kilogram | Weight |
| gram | gram | Weight |
| liter | liter | Volume |

## Number Words

| Bangla | Number |
|--------|--------|
| ek / ekta | 1 |
| dui / duita | 2 |
| tin / tinta | 3 |
| char / charta | 4 |
| panch / panchta | 5 |
| choy | 6 |
| shat | 7 |
| at / atta | 8 |
| noy | 9 |
| dosh | 10 |
| baro | 12 |
| bish | 20 |
| ponchash | 50 |
| eksho | 100 |

## Common Customer Phrases

| Customer Says | Intent | Action |
|--------------|--------|--------|
| "napa ache?" | Stock check | Search for Napa |
| "10 pata napa din" | Purchase | 10 strips of Napa |
| "total koto?" | Cart total | Show current total |
| "cash e dibo" | Payment mode | Cash |
| "bkash e dibo" | Payment mode | Mobile Payment |
| "baki ache?" | Balance check | Customer outstanding |
| "stock kom ki ki?" | Low stock | Run stock alerts |
| "discount diben?" | Discount | Apply if authorized |
| "bill dey" | Checkout | Complete the sale |
| "cancel koro" | Cancel | Clear cart |
