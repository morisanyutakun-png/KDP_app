"use client";

import { deleteMaterialAction } from "@/app/admin/actions";

export function DeleteMaterialButton({ id, title }: { id: string; title: string }) {
  return <form action={deleteMaterialAction}>
    <input type="hidden" name="id" value={id} />
    <button
      type="submit"
      className="text-xs font-bold text-red-600 hover:underline"
      onClick={(event) => {
        if (!window.confirm(`「${title}」を削除しますか？\n販売形式とクリック履歴も削除されます。この操作は元に戻せません。`)) event.preventDefault();
      }}
    >削除</button>
  </form>;
}
