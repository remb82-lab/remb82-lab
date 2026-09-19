(()=>{
  const tg=window.Telegram?.WebApp;
  if(!tg)return;
  tg.ready();
  tg.expand();
  try{tg.disableVerticalSwipes?.();}catch{}
  const root=document.documentElement;
  const applyTheme=()=>{
    const p=tg.themeParams||{};
    const map={
      '--tg-theme-bg-color':p.bg_color,
      '--tg-theme-text-color':p.text_color,
      '--tg-theme-hint-color':p.hint_color,
      '--tg-theme-link-color':p.link_color,
      '--tg-theme-button-color':p.button_color,
      '--tg-theme-button-text-color':p.button_text_color,
      '--tg-theme-secondary-bg-color':p.secondary_bg_color,
      '--tg-theme-section-separator-color':p.section_separator_color
    };
    for(const [k,v] of Object.entries(map))if(v)root.style.setProperty(k,v);
    if(p.bg_color)document.querySelector('meta[name="theme-color"]')?.setAttribute('content',p.bg_color);
  };
  applyTheme();
  tg.onEvent?.('themeChanged',applyTheme);
  const user=tg.initDataUnsafe?.user;
  addEventListener('DOMContentLoaded',()=>{
    const el=document.getElementById('tg-user');
    if(user&&el){
      const name=[user.first_name,user.last_name].filter(Boolean).join(' ');
      el.textContent=`Telegram: ${name}${user.username?' · @'+user.username:''}`;
      el.hidden=false;
    }
    tg.BackButton?.show?.();
    tg.BackButton?.onClick?.(()=>{
      const active=document.activeElement;
      if(active&&['INPUT','SELECT','TEXTAREA'].includes(active.tagName)){active.blur();return;}
      tg.close();
    });
  });
})();
