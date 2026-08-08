import { PublicFooter, PublicHeader } from "@/app/layout";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <><PublicHeader /><main>{children}</main><PublicFooter /></>;
}
