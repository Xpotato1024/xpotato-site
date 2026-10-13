---
status: proposed
owner: operations
last_verified: 2026-10-13
---

# ADR 0048：継続利用tokenの期限観測と未報告の明示採用

既存の本人作成・指定Worker限定Editor tokenを保存して継続利用する方針と、verifyで期限がoptionalであることを分ける。[PR93](https://github.com/Xpotato1024/xpotato-site/pull/93)は毎回の発行/失効を不要とし、[PR94](https://github.com/Xpotato1024/xpotato-site/pull/94)が手動経路を実装した。期限の数値条件はADR0043の方式B設計案であり、JITの直接の残存ではないが、最近の保存手順・再利用合意で本人へ必須条件として提示した根拠は確認できていない。

## 提案する判断

非秘密contextのtokenPolicyへacceptUnreportedExpiryを追加する。省略/falseは従来どおり停止。trueは期限未報告の不確実性と下記の違いを一度明示採用した記録であり、scope確認のownerPolicyReviewedとは別である。既存設定は変更しない。

- 許容はexpires_onの省略だけ。null/空値/不正形式、inactive、未来/不正not_beforeは停止。
- activeは確認時点の状態。未報告から「無期限」や未来の有効期間を推定しない。
- 未報告はexpiryEvidence=UNREPORTED、tokenLifetimePolicyVerified=false。90日上限・残存7日は検証できない。
- 未報告の場合、60日rotationは確認済み作成日時の下限からの助言だけとし、自動停止/再発行を要求しない。この扱いも今回の採用対象に含む。
- 期限が報告される場合は従来の90日上限・60日rotation・残存7日・失効検証を保持。
- 同一operation中のtoken ID・期限値・期限の報告/未報告・not_beforeの変化は停止。別IDのreadonly、対象Worker/zone/domain/version/正式artifact/public bytes検証を維持する。
- 旧JIT/B設計libraryの履歴契約は変更しない。本案を過去の本人合意そのものやlive安全保証へ読み替えない。

## 最終採用と実行の範囲

最終判断は本Draftのmain反映、準備済み非秘密contextの一度の更新、正式artifactによる本番配信1回・readbackを一括で行う。credential再発行/期限変更、追加権限、保護解除、追加診断、監視の先行完成を条件にしない。今はコード/offline/PRの準備だけで、merge・設定更新・provider操作を行わない。

providerが期限を返さない限界と、scopeのlive読取未確認は結果へ残す。公開応答PASSで不確実性を消さず、配信失敗/unknownなら追加配信せず本人判断へ戻る。

一次資料：[account token verify](https://developers.cloudflare.com/api/resources/accounts/subresources/tokens/methods/verify/)。返却された期限/activationは評価するが、optional欠落をtoken不備と即断しない。
