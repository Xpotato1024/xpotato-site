// Local progressive enhancement: changes the destination only; never navigates or sends data.
for (const root of document.querySelectorAll('[data-contact-issues]')) {
  const select = root.querySelector('select'), controls = root.querySelector('[data-issue-controls]'), fallback = root.querySelector('[data-issue-fallback]'), link = root.querySelector('[data-issue-go]'), status = root.querySelector('[role="status"]');
  const update = () => {
    const option = select.selectedOptions[0], href = option?.dataset.href;
    link.hidden = !href;
    if (href) {
      link.setAttribute('href', href);
      const issue = option.dataset.issue === 'true';
      link.textContent = issue ? 'GitHubでIssueを作成する ↗' : 'メールで問い合わせる ↗';
      status.textContent = issue ? option.textContent + 'の新規Issue作成画面へ進みます。' : 'このツールのIssue報告先は未設定です。メールをご利用ください。';
    } else { link.removeAttribute('href'); status.textContent = ''; }
  };
  select.addEventListener('change', update);
  window.addEventListener('pageshow', update);
  update(); controls.hidden = false; fallback.hidden = true;
}
