# Doughnut Economy by Country — live data edition

Plain HTML/CSS/JS clone of https://doughnut-economy-fxs7576.netlify.app/ (Felix Surjadjaja),
rebuilt so the data is live instead of stuck in ~2020.

No build step. No dependencies. GitHub Pages ready.

## Files

- `index.html`, `styles.css`, `app.js` — the app
- `data/countries.json` — 217 country ids/names
- `data/ecological-footprint.json` — per-capita consumption footprint (York NFA bulk, refreshed by automation)
- `data/material-footprint.json` — per-capita material footprint (seed baseline, same refresh path)
- `scripts/update_eco.py` + `.github/workflows/refresh-eco.yml` — monthly bulk refresh

## Live data design

Social foundation (12, all live World Bank WDI in-browser, latest value each):
clean cooking, electricity, internet, undernourishment, slums, literacy,
women in parliament, child mortality, life expectancy, homicides, drinking water, sanitation.

Ecological outer ring (6, each wedge shows year + value + boundary + source):
1. CO₂ per capita — World Bank `EN.GHG.CO2.PC.CE.AR5` live (to 2024) ÷ 1.6 t budget (O'Neill et al. 2018)
2. PM2.5 exposure — World Bank `EN.ATM.PM25.MC.M3` live (to 2023) ÷ 5 µg/m³ WHO 2021 guideline
3. Water stress — World Bank `ER.H2O.FWST.ZS` / SDG 6.4.2 live (to 2022) ÷ 25% FAO threshold
4. Freshwater per capita — World Bank `ER.H2O.INTR.PC` live (to 2022) vs 1700 m³ Falkenmark threshold (inverted: overshoot = below)
5. Material footprint — `data/material-footprint.json` ÷ 7.2 t budget (Good Life). Seeded from Leeds-2021 ratios; the UN SDG API (`EN_MAT_FTPRPC`) currently publishes only regional aggregates, so the refresh script keeps the seed until country data appears.
6. Ecological footprint — `data/ecological-footprint.json` ÷ 1.7 gha budget (Good Life). Real data from the York University National Footprint Accounts 2026 edition (data year 2023, estimates to 2025, 131 countries), refreshed monthly by automation.

Why not the original 6 Leeds ratios? They were a frozen 2021 snapshot with no live API behind them.
Footprint-vs-boundary ratios can't be fetched live anywhere; the honest fix is live
pressures with published boundaries (1–4) plus annually-refreshed bulk footprints (5–6).

## Run locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

(`file://` won't work — `fetch()` of `data/*.json` needs http.)

## Host on GitHub Pages

1. Push this folder to a GitHub repo (branch `main` or `master`).
2. Repo → Settings → Pages → Deploy from branch → select branch + `/ (root)`.
3. Open `https://<user>.github.io/<repo>/`.
4. Optional: Actions → enable the `refresh-eco` workflow so footprints update monthly.

## Credits

Concept: Kate Raworth. Original visualisation + data compilation: Felix Surjadjaja (MIT).
Social + pressure data: World Bank. Footprints: York Ecological Footprint Initiative /
Footprint Data Foundation (NFA), UNEP-IRP via UNSD. Boundaries: O'Neill et al. 2018,
WHO 2021, FAO. This rebuild: CC-BY-SA 4.0.
