# Kyozai Shelf — Amazon KDP 教材管理・公開カタログ

Amazon KDPで出版する教材を管理し、一般ユーザーには大学・科目・シリーズから探しやすい商品棚として公開するNext.jsアプリです。購入はAmazonへ送客し、アプリ内決済は行いません。

## 実装済みMVP

- 公開カタログ: 新着・注目・全教材、大学／科目／シリーズ／キーワード検索、24件単位のページング
- 商品詳細: 表紙、説明、問題構成、分類、難易度、ASIN、ISBN、販売形式、サンプルPDF、関連教材
- 管理者専用画面: 署名付きHttpOnly Cookie認証、教材の登録・編集・削除、教材CSV一括登録、制作状況・KDP状態・メモ
- 販売形式: 教材本体とKindle／ペーパーバック／ハードカバー等を別レコードで管理
- Vercel Blob: 表紙、サンプルPDF、KDP CSVをブラウザから直接アップロード
- KDP CSV: ASIN自動紐付け、未登録ASIN表示と後付け紐付け、ファイル／行の重複防止
- 売上: 今月、月別、商品別、大学別、科目別、シリーズ別の販売冊数
- 送客分析: Amazonリンクへのクリックを個人情報なしで記録し、商品・形式別に表示
- SEO: title、description、Open Graph、robots、sitemap、Book構造化データ、管理画面noindex

## 技術構成

- Next.js 16 / App Router / React 19 / TypeScript
- Tailwind CSS 4
- Neon Postgres + Drizzle ORM
- Vercel Blob（client upload）
- Vercel
- bcrypt + JOSEによる単一管理者認証

## ローカル起動

Node.js 20.9以上を使用してください。

```bash
npm install
cp .env.example .env.local
```

後述の値を `.env.local` に設定し、DBを作成します。

```bash
npm run db:migrate
npm run dev
```

`http://localhost:3000` が公開サイト、`http://localhost:3000/admin/login` が管理者ログインです。

任意で、実在商品情報を含まない画面確認用データを追加できます。

```bash
npm run db:seed
```

## 必要な環境変数

| 変数 | 必須 | 用途 |
| --- | --- | --- |
| `DATABASE_URL` | 必須 | Neonのpooled connection string |
| `BLOB_READ_WRITE_TOKEN` | ファイル利用時 | Vercel Blobのread-write token |
| `SESSION_SECRET` | 必須 | セッション署名。32文字以上のランダム値 |
| `ADMIN_EMAIL` | 必須 | 管理者ログイン用メールアドレス |
| `ADMIN_PASSWORD_HASH` | 必須 | bcrypt化した管理者パスワード |
| `NEXT_PUBLIC_SITE_URL` | 必須 | 公開URL。ローカルは `http://localhost:3000` |

秘密値をGitへコミットしないでください。`.env*` は `.gitignore` 対象で、`.env.example` だけを共有します。

セッション秘密鍵とパスワードハッシュは次のように作れます。

```bash
openssl rand -base64 32
npm run auth:hash -- '十分に長い管理者パスワード'
```

出力されたbcrypt文字列全体を `ADMIN_PASSWORD_HASH` に設定します。管理者メールアドレスやパスワードの実値はリポジトリに含まれていません。

Vercel Dashboardには `$2b$...` をそのまま貼り付けます。ローカルの `.env.local` ではNext.jsによる変数展開を避けるため、`\$2b\$12\$...` のように各 `$` をバックスラッシュでエスケープしてください。

## Neonの設定とDBセットアップ

1. NeonでProjectとDatabaseを作成します。
2. DashboardのConnectから、接続プールを使うconnection stringを取得します。
3. その値を `DATABASE_URL` に設定します。`sslmode=require` を維持してください。
4. `npm run db:migrate` を実行します。

スキーマは [src/lib/db/schema.ts](src/lib/db/schema.ts)、生成済みSQLは `drizzle/` にあります。変更時は次の順で反映します。

```bash
npm run db:generate
npm run db:migrate
```

主要テーブルは、教材、販売形式、大学、科目、シリーズ、CSV取込、売上行、Amazonクリック、更新履歴です。ASINは販売形式側に置き、同じ教材のKindle版と紙版を独立して管理します。

## Vercel Blobの設定

1. Vercel Dashboardで対象Projectを開きます。
2. StorageからBlob storeを作成し、Projectへ接続します。
3. 自動作成された `BLOB_READ_WRITE_TOKEN` をローカルにもコピーします。
4. 管理画面の教材フォームまたはCSV取込画面からアップロードします。

ファイル本体だけをBlobに置き、URL、ASIN、状態、売上などの構造化データはNeonに保存します。許可しているファイルは次の通りです。

- 表紙: JPEG / PNG / WebP / AVIF、10MBまで
- サンプル: PDF、50MBまで
- KDPレポート: CSV系MIME、50MBまで

アップロード用トークンは管理者セッションを確認したRoute Handlerだけが発行します。

## 教材登録

1. `/admin/login` からログインします。
2. 「教材管理」→「新規教材」を開きます。
3. タイトル、説明、分類、制作状況などを入力します。
4. 必要なら表紙とサンプルPDFを先にアップロードします。
5. 販売形式ごとにASIN、ISBN、Amazon URL、KDP状態を入力します。
6. 「公開カタログに表示」を有効にして保存します。

大学・科目・シリーズは入力値から自動作成されます。Amazon URLが空の販売形式には公開ページで購入ボタンを出しません。

### 教材CSV一括登録

1. 「教材管理」→「CSV一括登録」を開きます。
2. 画面からテンプレートをダウンロードし、教材を1行ずつ入力します。
3. CSVに販売形式がない場合の既定値と、新規教材を公開するかを選択します。
4. CSVを選択して「CSVを取り込む」を押します。

対応列は、`タイトル`、`ASIN`、`問題構成`、`説明`、`大学`、`科目`、`シリーズ`、`難易度`、`販売形式`、`Amazon URL`、`公開`です。タイトルは必須で、ASINは `B0...` と `ASIN: B0...` の両方に対応します。UTF-8／Shift-JIS、2MB・500件まで取り込めます。

- 同じASINがあれば、そのASINに紐づく教材を更新します。
- ASINが未入力または未登録でも、同じタイトルがあれば既存教材を更新します。
- 空欄の列では既存データを消しません。
- 新規行の空欄項目は未設定になり、説明を推測して補完しません。
- CSV取込直後の結果画面に、新規・更新・スキップ件数と行エラーを表示します。

教材の削除は教材一覧の「削除」から行えます。販売形式とAmazonクリック履歴も削除され、売上行は残したまま教材との紐付けだけが解除されます。削除操作は元に戻せないため、確認ダイアログを表示します。

このリポジトリに含まれる指定24冊を別のDBへ初期登録する場合は、マイグレーション後に次を一度実行できます。ASIN単位のupsertなので再実行しても重複しません。

```bash
npm run db:import:provided
```

## KDP CSV取込

1. KDPから売上レポートCSVをダウンロードします。KDPへの自動ログインやスクレイピングは行いません。
2. 管理画面の「CSV・売上」からファイルを選び、「アップロードして取込」を押します。
3. 原本がBlobへ保存され、その後に行データがNeonへ登録されます。
4. 登録済み販売形式とASINが一致すれば自動紐付けされます。
5. 不一致ASINは「未登録ASIN」から販売形式を選ぶと、過去行を含めて紐付けられます。

日付と販売冊数の列が必須です。代表的な英語・日本語列名（`Royalty Date`、`Sale Date`、`Date`、`Net Units Sold`、`Units Sold`、`販売冊数` など）を自動判別します。対応表は [src/lib/services/csv-import.ts](src/lib/services/csv-import.ts) に集約してあり、KDPの列変更時に拡張できます。

重複防止は二段階です。

- CSV全体のSHA-256が一致した場合、ファイル単位で再取込しません。
- 正規化した全列と同一行の出現順からSHA-256を作り、重なるレポート間で同じ売上行を再計上しません。

KDPレポートに取引IDがない場合、別取引か完全重複かを厳密には判定できません。この実装は同一内容の重複計上を防ぐ側に寄せています。将来、レポートに安定した取引IDが追加された場合は行ハッシュに採用してください。

## Vercelへのデプロイ

1. このリポジトリをGitHub等へpushし、VercelでNew Projectからimportします。
2. Framework PresetはNext.js、Build Commandは `npm run build` のままで構いません。
3. NeonとBlobをProjectへ接続します。
4. Production / Preview / Developmentに必要な環境変数を設定します。
5. `NEXT_PUBLIC_SITE_URL` を本番ドメインへ変更します。
6. 初回デプロイ前後に、本番 `DATABASE_URL` を設定した端末から `npm run db:migrate` を一度実行します。
7. デプロイし、管理画面から教材を登録します。

マイグレーションをbuild時に自動実行していないのは、Preview環境のbuildが意図せず本番DBを変更する事故を避けるためです。DB変更は明示的に実行してください。

## 品質チェック

```bash
npm run typecheck
npm run lint
npm run build
```

## 設計上の拡張ポイント

DBアクセスは `src/lib/data`、更新処理は `src/lib/services`、認証は `src/lib/auth.ts` に分離し、ページへSQLを散在させていません。売上行は原本JSONも保持するため、集計軸やCSV列が増えても移行しやすい構造です。将来のPDF検査、制作タスク、詳細な送客分析、ファイル管理は、教材IDまたは販売形式IDへ紐付くテーブル／サービスとして追加できます。
