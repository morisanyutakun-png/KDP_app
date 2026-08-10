# Mock Studio — 問題データベース／模試制作Webアプリ

問題を一問単位で蓄積し、条件検索した候補を第1問・第2問…へ配置して、試験紙面の印刷、PDF保存、Markdown／LaTeX書き出しまで行う教材制作者向けNext.jsアプリです。

旧サイトのKDP教材管理・公開商品棚は削除せず、`/admin/kdp`、`/admin/materials`、`/admin/imports`、`/catalog` に互換機能として残しています。トップ `/` は新しい制作画面 `/admin` へ移動します。

## 実装済みMVP

- Problem Bank: 問題本文、解答、解説をMarkdown＋TeX原稿として保存
- 問題メタデータ: 科目、分野、サブ分野、難易度、想定大学、想定時間、検証状態、図、管理メモ
- 複合検索: キーワード、分類、難易度範囲、大学、時間、使用済み／未使用、検証状態
- Mock Builder: 空の大問スロット、候補条件、配置／差し替え／解除、上下移動、簡易プレビュー
- 構成チェック: 合計時間、平均難易度、分野構成、他模試で使用済みの問題数
- 使用履歴: どの模試の第何問に採用したかを問題詳細に自動表示
- 紙面設定: A4／B5、9〜14pt、余白、ページ番号、大問ごとの改ページ、1段／2段
- 印刷プレビュー: 問題冊子、解答冊子、問題＋解答を切り替え、ブラウザ印刷またはPDF保存
- Export: TeX数式を保持したMarkdown、コンパイル可能なupLaTeX向け `.tex`
- 模試テンプレート: 問題数、試験時間、科目、大学、紙面設定を保存・再利用
- Vercel Blob: 問題図をブラウザから直接アップロード
- 単一管理者認証と管理画面noindex
- 既存KDP機能: 24教材、商品形式、表紙・価格、公開カタログ、売上CSV、Amazonクリック計測

## 技術構成

- Next.js 16 / App Router / React 19 / TypeScript
- Tailwind CSS 4
- Neon Postgres / Drizzle ORM
- Vercel Blob client upload
- `react-markdown` + `remark-math` + `rehype-katex` + KaTeX
- bcrypt + JOSEによる単一管理者認証
- Vercel

## ローカル起動

Node.js 20.9以上を使用します。

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

- 制作画面: `http://localhost:3000/admin`
- ログイン: `http://localhost:3000/admin/login`
- 既存の公開商品棚: `http://localhost:3000/catalog`

## 必要な環境変数

| 変数 | 必須 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 必須 | Neonのpooled connection string |
| `BLOB_READ_WRITE_TOKEN` | 画像・ファイル利用時 | Vercel Blobのread-write token |
| `SESSION_SECRET` | 必須 | Cookie署名用。32文字以上 |
| `ADMIN_EMAIL` | 必須 | 管理者ログイン用メールアドレス |
| `ADMIN_PASSWORD_HASH` | 必須 | bcrypt化した管理者パスワード |
| `NEXT_PUBLIC_SITE_URL` | 必須 | 末尾 `/` なしの公開URL |

生成例:

```bash
openssl rand -base64 32
npm run auth:hash -- '十分に長い管理者パスワード'
```

Vercelでは、出力された `$2b$...` をそのまま `ADMIN_PASSWORD_HASH` へ登録します。ローカルの `.env.local` ではNext.jsの変数展開を避けるため、bcrypt文字列内の各 `$` を `\$` としてください。秘密値をGitへコミットしないでください。

## Neon設定とDBセットアップ

1. NeonでProjectとDatabaseを作成します。
2. Connect画面でpooled connection stringを取得します。
3. `sslmode=require` を維持したURLを `DATABASE_URL` に設定します。
4. `npm run db:migrate` を実行します。

```bash
npm run db:generate  # schema.tsを変更してSQLを生成するとき
npm run db:migrate   # 生成済みSQLを対象DBへ適用するとき
```

スキーマは `src/lib/db/schema.ts`、マイグレーションは `drizzle/` にあります。今回の刷新では既存9テーブルを変更・削除せず、次を追加しています。

- `problems`: Markdown＋TeX原稿と問題メタデータ
- `mock_exams`: 模試本体と紙面設定
- `mock_exam_items`: 第n問のスロット、配置問題、候補条件
- `mock_templates`: 再利用する基本・紙面設定

使用履歴は `mock_exam_items` から導出するため、重複した履歴データを持ちません。問題は完全削除せずアーカイブし、過去の模試構成を保護します。既存の教材・販売形式・売上・クリック・CSV履歴もそのまま残ります。

## Vercel Blob設定

1. Vercel DashboardでProjectを開きます。
2. StorageからBlob storeを作成し、Projectへ接続します。
3. 自動作成された `BLOB_READ_WRITE_TOKEN` を必要なEnvironmentへ設定します。
4. ローカル利用時は同じ値を `.env.local` に設定します。

Blobへ置くのは問題図、表紙、PDF、CSVなどのファイル本体だけです。URLとメタデータはNeonへ保存します。管理者セッションを確認したRoute Handlerだけがアップロードトークンを発行します。

- 問題図・表紙: JPEG / PNG / WebP / AVIF（問題図はSVGも可）、10MBまで
- サンプルPDF: 50MBまで
- KDP CSV: 50MBまで

## 問題登録

1. `/admin/problems` で「問題を登録」を選びます。
2. 一覧用の管理タイトル、科目、分野、難易度、想定時間を入力します。問題IDは保存時に自動発行されます。
3. 分野・サブ分野・想定大学は既存データから候補が表示されます。表記を揃えると検索精度が上がります。
4. 問題本文、解答、解説をMarkdown＋TeXとして入力します。入力欄右側のライブプレビューで数式と改行を確認できます。
5. ツールバーからインライン数式、別行数式、分数、平方根、小問番号、場合分けの雛形を挿入できます。
6. 必要なら問題図をBlobへアップロードし、出典や作問上の注意は管理メモへ記録します。
7. 最初は「未検証」で保存し、解答・解説と紙面を確認後に「検証済み」へ変更します。

インライン数式は `$...$`、別行立ては `$$...$$` または `\[...\]` を使用します。管理タイトルと管理メモは問題用紙へ印刷されません。

「アーカイブ」はProblem Bankの通常検索から除外しますが、既存模試からは削除しません。

## 模試作成

1. `/admin/mocks/new` でテンプレートを選ぶか、試験時間・大問数・紙面を設定します。
2. 作成された第1問、第2問…の「候補条件を編集」で分野、サブ分野、難易度、未使用のみを設定します。
3. 「候補を選ぶ」から該当問題を配置します。
4. 「差し替える」「外す」「↑」「↓」で構成を調整します。
5. 上部の合計時間、平均難易度、分野構成、重複使用を確認します。

テンプレートは `/admin/templates` で作成します。テンプレートを後から削除しても、それを使って作成済みの模試は残ります。

## 印刷・PDF保存

Mock Builderの「紙面プレビュー」から次を切り替えられます。

- 問題のみ
- 解答・解説のみ
- 問題＋解答・解説

「印刷 / PDF保存」でブラウザの印刷画面を開きます。プリンターを選べば印刷、保存先をPDFにすればPDF化できます。印刷時はナビゲーション、編集ボタン、背景、プレビュー用の影を除外します。ブラウザの印刷設定では倍率100%を基本とし、ヘッダーとフッターはオフを推奨します。

## Markdown / LaTeX出力

Mock Builder上部から `.md` または `.tex` をダウンロードできます。標準リンクは問題＋解答です。URLの `mode` を次のいずれかにすると個別出力できます。

- `mode=questions`
- `mode=answers`
- `mode=combined`

Markdownは保存したTeX記法をそのまま維持します。LaTeXは日本語向け `jsarticle`、`amsmath`、`amssymb`、`geometry`、`hyperref` 等を含むupLaTeX想定ファイルです。Blob上の図はコンパイル環境が自動取得できないため、URLを枠内に記載します。完全な画像埋め込みが必要な場合は図をダウンロードして `\includegraphics` へ差し替えてください。

## 既存KDP機能

- `/admin/kdp`: 売上・Amazon送客ダッシュボード
- `/admin/materials`: 出版教材のGUI管理
- `/admin/materials/import`: 教材CSV一括登録
- `/admin/imports`: KDP売上CSV取込、ASIN自動紐付け、未登録ASINの後付け紐付け
- `/catalog`: 一般公開の商品棚

KDP CSVの原本はBlob、解析行はNeonへ保存します。ファイル全体と売上行のSHA-256により二重取込・二重計上を防ぎます。既存24教材を別DBへ入れるスクリプト `npm run db:import:provided` と、確認済みAmazonスナップショットを同期する `npm run db:sync:amazon` も維持しています。

## Vercelへのデプロイ

1. GitHubリポジトリをVercel Projectへimportします。
2. Framework PresetはNext.js、Build Commandは `npm run build` のままにします。
3. NeonとBlobをProjectへ接続します。
4. 上記6環境変数をProductionへ設定します。Previewを使う場合はPreviewにも設定します。
5. `NEXT_PUBLIC_SITE_URL` を本番URLへ設定します。
6. 本番 `DATABASE_URL` を設定した安全な端末から `npm run db:migrate` を一度実行します。
7. デプロイ後、`/admin/login`、問題登録、画像アップロード、模試作成、印刷を確認します。

マイグレーションはbuild時に自動実行しません。Preview buildが意図せず本番DBを変更するのを避け、DB変更を明示的な作業にするためです。

## 品質チェック

```bash
npm run typecheck
npm run lint
npm run build
```

DBアクセスは `src/lib/data`、書き出し処理は `src/lib/services`、更新はServer Actions、ファイルは専用Route Handlerへ分離しています。将来のPDF Preflight、問題類似度、AIメタデータ付与、自動構成、Web模試は、`problems` と `mock_exams` を中心に追加できます。
