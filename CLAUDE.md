# CLAUDE.md — Reticle

## Paeckchen-Methodik

Reticle wird in **Paeckchen** entwickelt — isolierten, abgeschlossenen Liefereinheiten mit klarem Scope.

Jedes Paeckchen:
- Hat eine Spec (im Kickoff-Message oder als Datei)
- Baut auf dem vorherigen auf, bricht es aber nicht
- Ist deploybar und testbar bevor das naechste beginnt
- Enthalt **keine** Scope-Creep aus kuenftigen Paeckchen

## Regeln fuer KLAW (und jeden anderen Executor)

1. **Kein Framework.** Vanilla JS, Vanilla CSS. Kein npm, kein Bundler, kein Import aus CDN ohne PO-Freigabe.
2. **CSS: Nur Klassen und IDs.** Keine nackten Tag-Selektoren (`nav`, `footer`, `section`, etc.).
3. **Keine Smart-Quotes** in Code- oder Konfigurationsdateien. ASCII-Anführungszeichen (`"`, `'`) everywhere.
4. **Designtokens** aus `style.css` nutzen — nie Farbwerte inline hardcoden.
5. **Scope-Disziplin**: Wenn etwas nicht im Paeckchen-Scope steht, nicht bauen. PO fragen.
6. **Unklarheiten** sofort eskalieren, nicht raten.

## Paeckchen-Uebersicht

| # | Titel | Branch/Tag |
|---|---|---|
| 0 | Setup & Skelett | `v0.1` |
| 1 | Listen-Datenmodell & Eingabe-Flow | — |
| 2 | Marker-Generierung | — |
| 3 | Scan-Flow | — |
| 4 | Dashboard | — |

## Deploy

GitHub Actions (.github/workflows/static.yml) deployed automatisch nach Push auf `main`.
Live: https://devcany.github.io/reticle
