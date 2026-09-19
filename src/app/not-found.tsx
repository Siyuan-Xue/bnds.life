import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty-state">
      <h1>没有找到这段回忆</h1>
      <p>这个地址暂时没有可观看的视频。</p>
      <Link href="/">返回首页</Link>
    </div>
  );
}
