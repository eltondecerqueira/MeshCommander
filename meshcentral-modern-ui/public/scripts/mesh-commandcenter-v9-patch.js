(function(){
  'use strict';
  var params=new URLSearchParams(location.search); if(params.get('mcmembed')==='1')return;
  function q(id){return document.getElementById(id);} function later(fn,ms){setTimeout(function(){try{fn();}catch(e){}},ms||0);}
  function allNodes(){var s=(window.nodes&&typeof nodes==='object')?nodes:((window.meshNodes&&typeof meshNodes==='object')?meshNodes:{});if(Array.isArray(s))return s.filter(Boolean);return Object.keys(s).map(function(k){var n=s[k];if(n&&!n._id)n._id=k;return n;}).filter(Boolean);}
  function byId(id){var a=allNodes();for(var i=0;i<a.length;i++)if(a[i]._id===id)return a[i];return null;}
  function realIdFromV8Token(token){if(byId(token))return token;var s=window.nodes;if(Array.isArray(s)){var i=parseInt(token,10);if(isFinite(i)&&s[i]&&s[i]._id)return s[i]._id;}return token;}
  function openById(id){id=realIdFromV8Token(id);var n=byId(id);if(!n)return;try{sessionStorage.setItem('meshcommander-v9-selected',id);}catch(e){}var dev=document.querySelector('#mcm7PrimaryNav [data-page="devices"]');if(dev)dev.click();later(function(){var all=document.querySelector('.mcm5-tabs [data-filter="all"]');if(all)all.click();var gf=q('mcm5GroupFilter');if(gf){gf.value='all';gf.dispatchEvent(new Event('change',{bubbles:true}));}var inp=q('mcm5LocalSearch');if(inp){inp.value=n.name||n.host||'';inp.dispatchEvent(new Event('input',{bubbles:true}));}later(function(){var rows=document.querySelectorAll('.mcm5-device-row[data-nodeid]');for(var i=0;i<rows.length;i++){if(rows[i].dataset.nodeid===id){rows[i].click();break;}}},120);},80);}
  function install(){var nav=q('mcm7PrimaryNav');if(nav&&!nav.dataset.mcm9Patch){nav.dataset.mcm9Patch='1';nav.addEventListener('click',function(e){var b=e.target.closest('[data-page]');if(b){var inv=q('mcm9InventoryPage');if(inv)inv.hidden=true;}},true);}
    var tabs=document.querySelector('.mcm5-detailtabs');if(tabs&&!tabs.dataset.mcm9Patch){tabs.dataset.mcm9Patch='1';tabs.addEventListener('click',function(e){var nativeTool=e.target.closest('[data-tool]');if(nativeTool){var ext=q('mcm9ExtendedView');if(ext)ext.hidden=true;}},true);}
    var sr=q('mcm8SearchResults');if(sr&&!sr.dataset.mcm9Patch){sr.dataset.mcm9Patch='1';sr.addEventListener('click',function(e){var b=e.target.closest('[data-mcm8-node]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();sr.hidden=true;openById(b.dataset.mcm8Node);},true);}
    var enc=document.querySelector('.mcm9-metric.enc');if(enc){var sub=enc.querySelector('small'),v=enc.querySelector(':scope > span');if(sub&&v&&/^0 de /.test(sub.textContent))v.textContent='—';}
  }
  var tries=0;(function wait(){tries++;install();if(tries<100)setTimeout(wait,250);})();
})();
