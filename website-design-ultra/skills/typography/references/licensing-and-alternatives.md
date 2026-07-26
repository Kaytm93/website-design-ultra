# Font Licensing and Open Alternatives

Status checked 2026-07-25. This is implementation triage, not legal advice. Re-open the linked publisher license before shipping because product tiers and embedding terms can change.

## Status vocabulary

- **OFL-1.1:** open source; web embedding and redistribution are generally allowed with the license/copyright retained.
- **Free proprietary:** commercial use may be free, but modification, redistribution, or self-hosting can be restricted.
- **Commercial:** obtain the correct web/app/domain/audience license before embedding.
- **OS-bundled/restricted:** local availability does not grant redistribution or webfont rights.
- **Unverified:** do not ship until the exact file and its authoritative license are identified.

## Complete matrix for plugin recommendations

| Family | Status / web action | Open-source alternative | Source |
|---|---|---|---|
| Geist Sans, Geist Mono | OFL-1.1; self-host with license | — | [Vercel license](https://github.com/vercel/geist-font/blob/main/LICENSE.txt) |
| PP Editorial New | Commercial; buy a Web License for each covered site/domain | Fraunces | [Product](https://pangrampangram.com/products/editorial-new), [EULA](https://pangrampangram.com/pages/eula) |
| Fraunces | OFL-1.1 | — | [Official repository](https://github.com/undercasetype/Fraunces) |
| Söhne, Söhne Mono | Commercial; WOFF2 requires the applicable Klim web/app license | Inter / IBM Plex Mono | [Family](https://klim.co.nz/fonts/soehne/), [licenses](https://klim.co.nz/licences/) |
| Inter, Inter Tight | OFL-1.1; retain license and reserved-name rules | — | [Official repository](https://github.com/rsms/inter) |
| IBM Plex Mono | OFL-1.1 | — | [IBM repository](https://github.com/IBM/plex) |
| Helvetica Now / Display | Commercial; purchase webfont rights | Archivo / Archivo Black | [Monotype family](https://www.monotype.com/fonts/helvetica-now) |
| Archivo, Archivo Black | OFL-1.1 | — | [Official repository](https://github.com/Omnibus-Type/Archivo) |
| SF Pro Display/Text, SF Mono | Apple-restricted; do not package or self-host for a general website | Geist Sans / Geist Mono | [Apple font license](https://developer.apple.com/fonts/) |
| Space Mono | OFL-1.1 | — | [Google Fonts repository](https://github.com/googlefonts/spacemono) |
| Recoleta | Commercial Latinotype family; acquire the correct webfont license | Fraunces | [Latinotype web EULA](https://www.latinotype.com/wp-content/uploads/Latinotype_EULA_Webfont_en.pdf) |
| Mona Sans | OFL-1.1 | — | [GitHub repository](https://github.com/github/mona-sans) |
| PP Neue Bit | Commercial/trial; verify the current Pangram Pangram web license before embedding | IBM Plex Mono | [Foundry EULA](https://pangrampangram.com/pages/eula) |
| Cabinet Grotesk | Free proprietary under ITF FFL; use the allowed Fontshare delivery path and do not treat it as open source | Archivo | [Fontshare license](https://www.fontshare.com/licenses/itf-ffl) |
| Satoshi | Free proprietary under ITF FFL; use the allowed Fontshare delivery path and do not treat it as open source | Geist Sans / Mona Sans | [Fontshare license](https://www.fontshare.com/licenses/itf-ffl) |
| JetBrains Mono | OFL-1.1 | — | [JetBrains repository](https://github.com/JetBrains/JetBrainsMono) |
| Berkeley Mono | Commercial; web fonts are a separately licensed module/tier | IBM Plex Mono | [Official product](https://usgraphics.com/products/berkeley-mono) |
| VAG Rounded | Commercial/proprietary; verify the exact vendor and web license | Nunito Sans | [Monotype catalog](https://www.monotype.com/) |
| Bubble Boddy | Unverified name/source; do not ship based on a download-site label | Dela Gothic One | Identify the original publisher first |
| Arial Rounded MT | OS/commercial proprietary; do not redistribute the local system file | Nunito Sans | [Microsoft font catalog](https://learn.microsoft.com/typography/font-list/) |
| Courier New | OS/commercial proprietary; use as a system fallback, not a bundled webfont | Space Mono | [Microsoft family page](https://learn.microsoft.com/typography/font-list/courier-new) |
| Eurostile | Commercial/proprietary | Michroma | [Monotype catalog](https://www.monotype.com/fonts/) |
| Bank Gothic | Commercial/proprietary | Michroma | [Monotype catalog](https://www.monotype.com/fonts/) |
| Druk | Commercial; purchase the applicable web license | Archivo Black | [Commercial Type family](https://commercialtype.com/catalog/druk/medium) |
| Bodoni 72 | Apple-bundled/proprietary; do not redistribute as a webfont | Bodoni Moda | [Apple typography resources](https://developer.apple.com/fonts/) |
| Bodoni Moda | OFL-1.1 | — | [Official repository](https://github.com/indestructible-type/Bodoni) |
| Source Sans 3 | OFL-1.1 | — | [Adobe repository](https://github.com/adobe-fonts/source-sans) |

Open alternatives such as Nunito Sans, Dela Gothic One, and Michroma must still be verified against their exact OFL files in the chosen distribution before bundling.

## Shipping decision

1. Record exact family, version, source URL, license type, domains/apps, traffic/seat tier, and proof of purchase.
2. Confirm whether subsetting, conversion, CDN serving, contractor sharing, and source redistribution are permitted.
3. Store required OFL/copyright files beside redistributed open fonts.
4. If any field is unknown, use the listed open alternative and re-art-direct spacing rather than metrically impersonating the restricted family.
5. Recheck coverage for every locale; similar Latin appearance does not imply equivalent Cyrillic, Greek, Arabic, CJK, or Indic support.
