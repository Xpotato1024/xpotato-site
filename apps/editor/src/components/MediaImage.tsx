import { useState } from "react";

export function MediaImage({
  src,
  alt,
  loading,
}: {
  src: string;
  alt: string;
  loading?: "eager" | "lazy";
}) {
  const [failed, setFailed] = useState("");
  if (src && failed === src) {
    return (
      <div className="cms-image-error" role="status">
        <strong>画像を表示できません</strong>
        {alt && <span>{alt}</span>}
        <small>画像パネルの「同期済みの画像を取得・修復」から復元できます。</small>
      </div>
    );
  }
  return src ? <img src={src} alt={alt} loading={loading} onError={() => setFailed(src)} /> : null;
}
