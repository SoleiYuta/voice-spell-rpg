---
type: concept
title: "UnityAddressablesとAIアセット管理"
updated: 2026-05-10
tags:
  - unity
  - addressables
  - asset-management
  - claude-code
  - async
  - dlc
status: developing
related:
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[VContainer・UniTask・R3とAI連携パターン]]"
  - "[[Unity MCP統合]]"
---

# UnityAddressablesとAIアセット管理

Unity Addressablesの非同期アセット読み込みとDLC対応をClaude Codeで実装するパターン。CLAUDE.mdへの記載でAIが正しいAPIを使うよう誘導できる。

---

## なぜAddressablesをCLAUDE.mdに記載すべきか

AIはAddressablesを使わずに `Resources.Load()` や直接参照でコードを生成しがち。CLAUDE.mdに明示することでモバイルビルドサイズの肥大化を防げる。

### CLAUDE.mdへの記載例

```markdown
## アセット管理
- Resourcesフォルダは使わない (Addressables必須)
- パッケージ: com.unity.addressables v2.x
- UniTask と組み合わせて非同期読み込み
- AsyncOperationHandle は必ずReleaseすること (メモリリーク防止)
- Resources.Load() の使用は禁止
- 参照はAssetReferenceT<T> 型を使う (文字列キーは避ける)
```

---

## 基本的なロードパターン

### UniTask + Addressables (推奨パターン)

```
プロンプト例:
「Addressables + UniTaskを使った非同期スプライト読み込み:
- AssetReferenceSprite でスプライトを参照
- LoadAssetAsync<Sprite>().ToUniTask() で読み込み
- try/finallyでAsyncOperationHandle.Release()を保証
- キャッシュ機能: 同じキーは2回読み込まない
- MonoBehaviourのOnDestroyでReleaseする」
```

```csharp
// AIが生成する典型的なコード
public class SpriteLoader : MonoBehaviour
{
    [SerializeField] private AssetReferenceSprite _spriteRef;
    private AsyncOperationHandle<Sprite> _handle;

    async UniTaskVoid LoadSpriteAsync(CancellationToken ct)
    {
        _handle = _spriteRef.LoadAssetAsync<Sprite>();
        var sprite = await _handle.ToUniTask(cancellationToken: ct);
        GetComponent<SpriteRenderer>().sprite = sprite;
    }

    void OnDestroy()
    {
        if (_handle.IsValid()) Addressables.Release(_handle);
    }
}
```

---

## Addressables Group 設計パターン

AIにAddressables Groupの設計を提案させる際のプロンプト。

```
プロンプト例:
「モバイル向けAddressables Group設計:
- DefaultLocalGroup: 起動時に必要なアセット (UI, Player)
- LevelGroup_[1-10]: ステージごとのアセット
- CharacterDLC_[A-F]: キャラクターDLCパック
- AudioGroup: BGM/SE (Remote Content)

各Groupの設定:
- Build Path: LocalBuildPath vs RemoteBuildPath
- Load Path: LocalLoadPath vs RemoteLoadPath
- Bundle Mode: Pack Together vs Pack Separately
を理由とともに提案して」
```

---

## DLC対応パターン

```
プロンプト例:
「Addressables Remote ContentによるDLC実装:
- DLCManager.cs を作成
- CheckForUpdates(): Addressablesのカタログ更新を確認
- DownloadDLC(string label): ラベルでDLCをダウンロード
- GetDownloadSize(string label): ダウンロードサイズを返す
- InstallDLC(): ダウンロード後にコンテンツを利用可能にする
- 進捗はIProgress<float>で報告
- UniTaskを使用」
```

---

## Unity MCP経由でのアセット管理

mcp-unity (CoplayDev) を使うとClaude CodeがEditor内のアセットを直接操作できる。

```
Claude Codeへの指示例:
「Addressablesの設定を確認して:
1. Resources.Loadを使っているスクリプトをすべてリストアップ
2. 各スクリプトのAssetReferenceに移行する修正案を提案
3. Addressables Groupに未追加のアセットを特定」
```

**Unity MCP ツール**: `manage_addressables` (mcp-unity v10+), `search_assets`, `import_asset`

---

## claude-code-game-studios の Addressables スキル

sr4p/claude-code-game-studios の Unity エンジンリファレンスに Addressables パターン集が含まれている。(medium: github.com/sr4p/claude-code-game-studios)

```
スキル: $unity-addressables
  - アセット読み込み
  - メモリ管理 (Reference Counting)
  - DLC / Remote Content
  - ビルドレポート解析
```

---

## Addressables AI生成時の注意点

1. **Handle.Release忘れ**: AIはRelease処理を省略しがち。CLAUDE.mdに「必ずReleaseすること」と記載。
2. **文字列キー vs AssetReference**: 文字列キー ("Sprites/Player") は typo でサイレント失敗する。AssetReferenceT<T> を強制。
3. **同期的読み込みの混入**: `_handle.WaitForCompletion()` はメインスレッドブロック。UniTaskの非同期を維持させる。
4. **エディタ設定の見落とし**: AIはPackaging設定 (Bundle Mode, Build Path) を提案できるが、实際のUnityEditor設定は人間が確認する。

---

## 出典

- (Source: docs.unity3d.com/Packages/com.unity.addressables@latest/manual/LoadingAddressableAssets.html)
- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-game-development-guide)
- (Source: github.com/sr4p/claude-code-game-studios/blob/main/docs/engine-reference/unity/PLUGINS.md)
- (Source: github.com/CoplayDev/unity-mcp)
- (Source: discussions.unity.com/t/mcp-ai-ide-cursor-antigravity-claude-code-windsurf-next-steps-for-unity-workflow-automation/1705679)
