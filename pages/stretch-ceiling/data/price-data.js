// Compatibility loader for the chunked LumFer offline price database.
// Kept synchronous because the calculator reads window.PRICE_DB during initial module startup.
(()=>{
  const files=['price-base.js',...Array.from({length:13},(_,i)=>`price-products-${String(i+1).padStart(2,'0')}.js`)];
  const base=new URL('.',document.currentScript.src).href;
  document.write(files.map(name=>`<script src="${base}${name}"><\/script>`).join(''));
})();
