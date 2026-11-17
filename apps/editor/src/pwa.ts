export async function registerEditorWorker(){
 if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
 const registration=await navigator.serviceWorker.register('/editor/sw.js',{scope:'/editor/'});
 registration.addEventListener('updatefound',()=>{const worker=registration.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)window.dispatchEvent(new Event('editor-update-ready'));});});
}
