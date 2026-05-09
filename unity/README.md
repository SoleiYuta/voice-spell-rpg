# unity/

Unity プロジェクトディレクトリ。**現在未作成。**

フェーズ0 (Mock完結) 以降に Unity プロジェクトをここに配置する予定。

## 配置予定構造

```
unity/
├── Assets/
│   └── Scripts/
│       ├── API/           ApiConfig, ISpellApiClient, MockSpellApiClient
│       ├── Combat/        CombatManager, Enemy
│       ├── UI/            SpellUI, RecordingButton
│       └── Core/          GameLifetimeScope (VContainer DI)
├── Packages/              push推奨
├── ProjectSettings/       push推奨
├── Library/               .gitignore済み (push非推奨)
├── Temp/                  .gitignore済み
└── Logs/                  .gitignore済み
```

## 設計ドキュメント

実装前に以下を読む:

- `wiki/AI-Grimoire/Unity責務分割` — スクリプト役割・DI設定
- `wiki/AI-Grimoire/SpellResultデータ構造` — EvaluationResult フィールド仕様
- `wiki/AI-Grimoire/MockApiClient運用` — Mock切替手順

## 禁止事項

- DOTS/ECS を使わない
- Coroutine と UniTask を混在させない
- EvaluationResult フィールドを camelCase にしない (snake_case 必須)
- `useMock = false` でコミットしない (フェーズ0)
