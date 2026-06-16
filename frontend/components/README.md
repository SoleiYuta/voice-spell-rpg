# components/

ゲーム画面のコンポーネント置き場。担当は `../AGENTS.md` と `wiki/AI-Grimoire/10_Web設計書` を参照。

- **蒸し焼き(kazuma660)**: `TitleScreen` / `SpellCard` / `RecordButton` / `EvaluatingOverlay`
- **harukichi(Haruku-Sato)**: `BattleScene` / `EvaluationBars` / `GMComment` / `ResultScreen`

`app/page.tsx` の雛形（スモークテスト）を、これらのコンポーネント＋`lib/useGame.ts`(#21) の状態機械で本物のゲームループに差し替える。
