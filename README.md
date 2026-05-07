# Parcel Panic

Parcel Panic is a portrait-first HTML5 physics stacking mini-game for Gametize custom projects.

## Run

Open `index.html` in a browser, or serve this folder with any static server:

```powershell
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Stack

- Vendored Phaser 3.90
- Matter.js physics through Phaser
- DOM HUD and menu overlays
- Procedural comic-style placeholder art
- Local leaderboard via `localStorage`
- Gametize score bridge event and optional `window.GametizeGame.submitScore`

## Gametize Integration

Before loading the game, a host page may define:

```js
window.PARCEL_PANIC_CONFIG = {
  campaignId: "campaign-id",
  playerId: "user-id",
  durationSeconds: 60,
  submitScoreEndpoint: ""
};
```

On game completion, the game:

- stores local leaderboard results
- calls `window.GametizeGame.submitScore(result)` when available
- dispatches `parcel-panic:score` with the score payload

## Asset Replacement

The current build generates parcel sprites and comic FX at runtime so it is immediately playable. Replace these with final PNG/WebP assets by loading files in `GameScene.preload()` and keeping the existing texture keys:

- `parcel-small`
- `parcel-medium`
- `parcel-heavy`
- `parcel-golden`
- `burst`
