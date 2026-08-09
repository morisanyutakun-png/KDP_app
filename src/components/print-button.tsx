"use client";

export function PrintButton() {
  return <button type="button" className="btn-primary" onClick={() => window.print()}>印刷 / PDF保存</button>;
}
