export function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  // click直後の解放ではブラウザが読み取る前に参照を失う場合がある。
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
