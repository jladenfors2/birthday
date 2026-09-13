# Katarina 50

Ett skoj projekt för att fira min fru Katarina som fyller 50.

Vänner och familj får en länk, spelar in en 10-sekunders videohälsning och skickar den. Hälsningarna samlas i ett valv och kan visas som en jubileumsglob — ett minne som består.

Live: [https://katarina50.up.railway.app](https://katarina50.up.railway.app)

## Så funkar det

1. På värdsidan skapas en länk (svenska eller engelska).
2. Gästen öppnar länken, spelar in 10 sekunder och skickar.
3. Hälsningarna dyker upp i valvet. Glob-länken är till för att spara och visa upp dem sen.

Gästlänken kräver ingen inloggning. Värdsidan är skyddad med användarnamn och lösenord.

## Köra lokalt

Kopiera `.env.example` till `.env` och fyll i `ADMIN_USER`, `ADMIN_PASSWORD` och `SESSION_SECRET`. Lösenordet ska inte ligga i git.

```bash
npm install
npm start
```

Öppna [http://localhost:3000](http://localhost:3000). Kameran kräver HTTPS eller `localhost`.

På Railway sätts samma värden som hemliga miljövariabler.
