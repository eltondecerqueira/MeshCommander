(function () {
  'use strict';

  var VERSION = 'v7';
  var params = new URLSearchParams(window.location.search);
  if (params.get('mcmembed') === '1') return;

  var TREND_KEY = 'meshcommander-v7-availability';
  var RULES_KEY = 'meshcommander-v7-rules';
  var currentPage = 'dashboard';
  var renderTimer = null;
  var sampleTimer = null;

  function q(id) { return document.getElementById(id); }
  function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function txt(v) { return (v == null || v === '') ? '—' : String(v); }
  function esc(v) { return txt(v).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function jsonGet(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch (e) { return fallback; } }
  function jsonSet(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }

  function nodeMap() { return (window.nodes && typeof window.nodes === 'object') ? window.nodes : ((window.meshNodes && typeof window.meshNodes === 'object') ? window.meshNodes : {}); }
  function nodes() {
    var m = nodeMap(), out = [];
    Object.keys(m).forEach(function (k) { var n = m[k]; if (n && typeof n === 'object') { if (!n._id) n._id = k; out.push(n); } });
    return out;
  }
  function meshMap() { return (window.meshes && typeof window.meshes === 'object') ? window.meshes : {}; }
  function meshName(n) { var m = n && n.meshid ? meshMap()[n.meshid] : null; return txt(m && (m.name || m.mname)); }
  function nodeName(n) { return txt(n && (n.name || n.host || n.computerName || n._id)); }
  function nodeIp(n) { return txt(n && (n.ip || n.ipaddr || n.addr || n.host)); }
  function nodeOs(n) { return txt(n && (n.osdesc || n.os || n.platform || (n.agent && n.agent.name))); }
  function online(n) { return num(n && n.conn) > 0; }
  function attention(n) {
    if (!n || !online(n)) return false;
    if (n.warning || n.warn || n.health === 'warning' || n.health === 'critical') return true;
    return Array.isArray(n.tags) && n.tags.some(function (x) { return /warn|alert|attention|critical/i.test(String(x)); });
  }
  function osFamily(n) {
    var s = nodeOs(n).toLowerCase();
    if (/windows server/.test(s)) return 'Windows Server';
    if (/windows 11/.test(s)) return 'Windows 11';
    if (/windows 10/.test(s)) return 'Windows 10';
    if (/windows/.test(s)) return 'Outros Windows';
    if (/mac|darwin|os x/.test(s)) return 'macOS';
    if (/linux|ubuntu|debian|red hat|rhel|centos|fedora|suse/.test(s)) return 'Linux';
    return 'Outros';
  }
  function metrics() {
    var list = nodes(), result = { total:list.length, online:0, offline:0, attention:0, agent:0, amt:0, desktop:0, terminal:0, files:0, console:0 };
    list.forEach(function (n) {
      if (online(n)) result.online++; else result.offline++;
      if (attention(n)) result.attention++;
      if (n.agent) result.agent++;
      if (n.intelamt) result.amt++;
      var caps = num(n.agent && n.agent.caps);
      if (caps & 1) result.desktop++;
      if (caps & 2) result.terminal++;
      if (caps & 4) result.files++;
      if (caps & 8) result.console++;
    });
    result.groups = Object.keys(meshMap()).length;
    result.availability = result.total ? (result.online / result.total * 100) : 0;
    return result;
  }

  function countsBy(fn) {
    var map = {};
    nodes().forEach(function (n) { var k = fn(n); map[k] = (map[k] || 0) + 1; });
    return Object.keys(map).map(function (k) { return { name:k, value:map[k] }; }).sort(function (a,b) { return b.value - a.value; });
  }
  function groupHealth() {
    var groups = {}, mm = meshMap();
    Object.keys(mm).forEach(function (id) { groups[id] = { id:id, name:txt(mm[id] && (mm[id].name || mm[id].mname || id)), total:0, online:0, offline:0 }; });
    nodes().forEach(function (n) { var g = groups[n.meshid] || (groups[n.meshid] = { id:n.meshid || 'unknown', name:meshName(n), total:0, online:0, offline:0 }); g.total++; if (online(n)) g.online++; else g.offline++; });
    return Object.keys(groups).map(function (id) { return groups[id]; }).filter(function (g) { return g.total > 0; }).sort(function (a,b) { return b.offline - a.offline || b.total - a.total; });
  }

  function svgDonut(onlineCount, offlineCount) {
    var total = Math.max(1, onlineCount + offlineCount), pct = onlineCount / total, r = 44, c = 2 * Math.PI * r, dash = c * pct;
    return '<svg class="mcm7-donut" viewBox="0 0 120 120"><circle cx="60" cy="60" r="44" class="track"></circle><circle cx="60" cy="60" r="44" class="value" stroke-dasharray="'+dash+' '+(c-dash)+'" transform="rotate(-90 60 60)"></circle><text x="60" y="57" text-anchor="middle" class="big">'+Math.round(pct*100)+'%</text><text x="60" y="74" text-anchor="middle" class="small">online</text></svg>';
  }
  function bars(items, maxItems) {
    items = items.slice(0, maxItems || 6);
    var max = Math.max.apply(null, items.map(function (x) { return x.value; }).concat([1]));
    return '<div class="mcm7-bars">' + items.map(function (x) { var p = Math.max(2, x.value / max * 100); return '<div class="mcm7-bar"><div><span>'+esc(x.name)+'</span><b>'+x.value+'</b></div><i><em style="width:'+p+'%"></em></i></div>'; }).join('') + '</div>';
  }
  function stackedGroups(items) {
    return '<div class="mcm7-group-health">' + items.slice(0,7).map(function (g) { var on = g.total ? g.online/g.total*100 : 0; return '<button data-mcm7-group="'+esc(g.id)+'"><div><b>'+esc(g.name)+'</b><span>'+g.online+' online · '+g.offline+' offline</span></div><i><em style="width:'+on+'%"></em></i><strong>'+Math.round(on)+'%</strong></button>'; }).join('') + '</div>';
  }
  function lineChart(samples) {
    if (!samples.length) return '<div class="mcm7-empty">Aguardando amostras desta sessão.</div>';
    var view = samples.slice(-60), w = 520, h = 130, pad = 12;
    var points = view.map(function (s, i) { var x = pad + (view.length === 1 ? 0 : i/(view.length-1)*(w-pad*2)); var y = pad + (100 - Math.max(0,Math.min(100,s.pct)))/100*(h-pad*2); return x.toFixed(1)+','+y.toFixed(1); }).join(' ');
    var last = view[view.length-1];
    return '<div class="mcm7-trend"><svg viewBox="0 0 '+w+' '+h+'"><line x1="12" y1="12" x2="12" y2="118"></line><line x1="12" y1="118" x2="508" y2="118"></line><polyline points="'+points+'"></polyline></svg><div><span>Observado no navegador</span><b>'+Math.round(last.pct)+'%</b></div></div>';
  }

  function sampleAvailability() {
    var m = metrics(), arr = jsonGet(TREND_KEY, []);
    arr.push({ t:Date.now(), pct:m.availability, online:m.online, total:m.total });
    arr = arr.filter(function (x) { return x && x.t > Date.now() - 24*60*60*1000; }).slice(-240);
    jsonSet(TREND_KEY, arr);
  }

  function addTopNavigation(shell) {
    var top = shell.querySelector('.mcm5-topbar');
    if (!top || q('mcm7PrimaryNav')) return;
    var brand = document.createElement('div');
    brand.id = 'mcm7HeaderBrand';
    brand.className = 'mcm7-header-brand';
    brand.innerHTML = '<span class="mcm7-mark">M</span><div><b>MeshCommander</b><small>Service Desk</small></div>';
    top.insertBefore(brand, top.firstChild);

    var nav = document.createElement('nav');
    nav.id = 'mcm7PrimaryNav';
    nav.className = 'mcm7-primary-nav';
    nav.innerHTML = [
      '<button data-page="dashboard" class="active">Visão Geral</button>',
      '<button data-page="devices">Dispositivos</button>',
      '<button data-page="groups">Grupos</button>',
      '<button data-page="automation">Automação <span class="mcm7-beta">LAB</span></button>',
      '<button data-page="activity">Atividade</button>',
      '<button id="mcm7MoreButton" data-page="more">Mais ▾</button>'
    ].join('');
    var search = top.querySelector('.mcm5-global-search');
    top.insertBefore(nav, search || null);

    var menu = document.createElement('div');
    menu.id = 'mcm7MoreMenu';
    menu.className = 'mcm7-more-menu';
    menu.hidden = true;
    menu.innerHTML = '<button data-native="LeftMenuMyAccount">Minha Conta</button><button data-native="LeftMenuMyEvents">Eventos nativos</button><button data-native="LeftMenuMyFiles">Arquivos do servidor</button><button data-native="LeftMenuMyUsers">Usuários</button><button data-native="LeftMenuMyServer">Servidor</button><hr><button data-native-view="1">Interface nativa</button>';
    top.appendChild(menu);
  }

  function buildPages() {
    var main = document.querySelector('#mcmV5Shell .mcm5-main');
    if (!main || q('mcm7DashboardPage')) return;
    var dashboard = document.createElement('section');
    dashboard.id = 'mcm7DashboardPage';
    dashboard.className = 'mcm7-page';
    dashboard.innerHTML = '<div class="mcm7-pagehead"><div><h1>Central de Operações</h1><p>Visão acionável para Service Desk, suporte remoto e saúde do parque.</p></div><div class="mcm7-head-actions"><span class="mcm7-live"><i></i> Dados ao vivo do MeshCentral</span><button id="mcm7Refresh">Atualizar</button></div></div><div id="mcm7DashboardBody"></div>';

    var automation = document.createElement('section');
    automation.id = 'mcm7AutomationPage'; automation.className = 'mcm7-page'; automation.hidden = true;
    automation.innerHTML = '<div class="mcm7-pagehead"><div><h1>Automação</h1><p>Playbooks e regras para reduzir tarefas repetitivas. Execução permanece bloqueada até o worker ser validado.</p></div><div class="mcm7-head-actions"><span class="mcm7-preview">ENFORCEMENT OFF</span><button id="mcm7NewRule">Nova regra</button></div></div><div id="mcm7AutomationBody"></div>';

    var activity = document.createElement('section');
    activity.id = 'mcm7ActivityPage'; activity.className = 'mcm7-page'; activity.hidden = true;
    activity.innerHTML = '<div class="mcm7-pagehead"><div><h1>Atividade do Service Desk</h1><p>Prioridades, acessos recentes e pontos que merecem atenção.</p></div></div><div id="mcm7ActivityBody"></div>';
    main.appendChild(dashboard); main.appendChild(automation); main.appendChild(activity);

    var modal = document.createElement('div');
    modal.id = 'mcm7RuleModal'; modal.className = 'mcm7-modal'; modal.hidden = true;
    modal.innerHTML = '<div class="mcm7-modal-card"><header><div><b>Nova regra de automação</b><small>Salva como rascunho local; o worker não executa automaticamente.</small></div><button id="mcm7RuleClose">×</button></header><div class="mcm7-form"><label>Nome<input id="mcm7RuleName" placeholder="Ex.: Alertar quando dispositivo ficar offline"></label><label>Condição<select id="mcm7RuleTrigger"><option value="offline">Dispositivo offline</option><option value="noagent">Agente ausente</option><option value="amtmissing">Intel AMT ausente</option><option value="subnet">IP / subnet</option></select></label><label>Valor<input id="mcm7RuleValue" placeholder="Opcional; ex.: 10.20."></label><label>Ação<select id="mcm7RuleAction"><option value="notify">Notificar / criar ticket</option><option value="diagnostics">Coletar diagnóstico</option><option value="runcommand">Executar playbook</option><option value="movegroup">Mover de grupo</option></select></label></div><footer><button id="mcm7RuleCancel">Cancelar</button><button id="mcm7RuleSave" class="primary">Salvar rascunho</button></footer></div>';
    document.body.appendChild(modal);
  }

  function hideV5Pages() {
    ['mcm5DevicesPage','mcm5GroupsPage','mcm5SectionPage'].forEach(function (id) { var el=q(id); if(el) el.hidden=true; });
    ['mcm7DashboardPage','mcm7AutomationPage','mcm7ActivityPage'].forEach(function (id) { var el=q(id); if(el) el.hidden=true; });
  }
  function setTopActive(page) { qa('#mcm7PrimaryNav [data-page]').forEach(function (b) { b.classList.toggle('active', b.dataset.page === page); }); }
  function clickV5Nav(selector) { var b = document.querySelector(selector); if (b && b.click) b.click(); }

  function showPage(page) {
    currentPage = page;
    var more = q('mcm7MoreMenu'); if (more) more.hidden = true;
    if (page === 'devices') { hideV5Pages(); clickV5Nav('.mcm5-navitem[data-section="devices"]'); setTopActive('devices'); return; }
    if (page === 'groups') { hideV5Pages(); clickV5Nav('.mcm5-navitem[data-section="groups"]'); setTopActive('groups'); return; }
    hideV5Pages(); setTopActive(page);
    if (page === 'dashboard') { q('mcm7DashboardPage').hidden=false; renderDashboard(); }
    if (page === 'automation') { q('mcm7AutomationPage').hidden=false; renderAutomation(); }
    if (page === 'activity') { q('mcm7ActivityPage').hidden=false; renderActivity(); }
  }

  function renderDashboard() {
    var host=q('mcm7DashboardBody'); if(!host) return;
    var m=metrics(), os=countsBy(osFamily), groups=groupHealth(), trend=jsonGet(TREND_KEY, []);
    host.innerHTML = [
      '<section class="mcm7-kpis">',
        '<button data-go="devices"><span class="blue">▣</span><div><strong>'+m.total+'</strong><b>Endpoints</b><small>'+m.groups+' grupos</small></div></button>',
        '<button data-filter="online"><span class="green">✓</span><div><strong>'+m.online+'</strong><b>Online</b><small>'+Math.round(m.availability)+'% disponível</small></div></button>',
        '<button data-filter="offline"><span class="red">!</span><div><strong>'+m.offline+'</strong><b>Offline</b><small>priorizar triagem</small></div></button>',
        '<button data-go="automation"><span class="amber">⚡</span><div><strong>'+m.attention+'</strong><b>Atenção</b><small>candidatos a automação</small></div></button>',
        '<button data-go="devices"><span class="cyan">◉</span><div><strong>'+m.amt+'</strong><b>Intel AMT</b><small>'+Math.round(m.total?m.amt/m.total*100:0)+'% cobertura</small></div></button>',
      '</section>',
      '<section class="mcm7-dashboard-grid">',
        '<article class="mcm7-widget availability"><header><div><b>Disponibilidade agora</b><small>estado de conexão reportado pelo MeshCentral</small></div></header><div class="mcm7-donut-wrap">'+svgDonut(m.online,m.offline)+'<div class="legend"><span><i class="green"></i>'+m.online+' online</span><span><i class="red"></i>'+m.offline+' offline</span><span><i class="amber"></i>'+m.attention+' atenção</span></div></div></article>',
        '<article class="mcm7-widget os"><header><div><b>Sistemas operacionais</b><small>inventário atual dos endpoints</small></div></header>'+bars(os,7)+'</article>',
        '<article class="mcm7-widget groups"><header><div><b>Saúde por grupo</b><small>grupos com maior impacto offline primeiro</small></div><button data-go="groups">Ver grupos</button></header>'+stackedGroups(groups)+'</article>',
        '<article class="mcm7-widget capabilities"><header><div><b>Cobertura de ferramentas</b><small>capacidades anunciadas pelos agentes</small></div></header>'+bars([{name:'Desktop/KVM',value:m.desktop},{name:'Terminal',value:m.terminal},{name:'Arquivos',value:m.files},{name:'Console',value:m.console},{name:'Intel AMT',value:m.amt}],5)+'</article>',
        '<article class="mcm7-widget trend"><header><div><b>Tendência de disponibilidade</b><small>amostras observadas por este navegador; não é série histórica do servidor</small></div></header>'+lineChart(trend)+'</article>',
        '<article class="mcm7-widget queue"><header><div><b>Fila sugerida do Service Desk</b><small>priorização por indisponibilidade e atenção</small></div><button data-go="activity">Abrir fila</button></header>'+serviceDeskQueue(groups)+'</article>',
      '</section>'
    ].join('');
    bindDashboardActions(host);
  }

  function serviceDeskQueue(groups) {
    var off = nodes().filter(function(n){return !online(n);}).slice(0,6);
    var att = nodes().filter(attention).slice(0,4);
    var list = att.concat(off.filter(function(n){return att.indexOf(n)<0;})).slice(0,8);
    if (!list.length) return '<div class="mcm7-empty">Nenhum item prioritário detectado neste momento.</div>';
    return '<div class="mcm7-queue">'+list.map(function(n){ var s=online(n)?'attention':'offline'; return '<button data-node="'+esc(n._id)+'"><span class="'+s+'"></span><div><b>'+esc(nodeName(n))+'</b><small>'+esc(meshName(n))+' · '+esc(nodeIp(n))+'</small></div><strong>'+(s==='offline'?'Offline':'Atenção')+'</strong></button>'; }).join('')+'</div>';
  }

  function bindDashboardActions(root) {
    qa('[data-go]',root).forEach(function(b){ b.onclick=function(){showPage(b.dataset.go);}; });
    qa('[data-filter]',root).forEach(function(b){ b.onclick=function(){ showPage('devices'); window.setTimeout(function(){ var t=document.querySelector('.mcm5-tabs button[data-filter="'+b.dataset.filter+'"]'); if(t&&t.click)t.click(); },100); }; });
    qa('[data-mcm7-group]',root).forEach(function(b){ b.onclick=function(){ showPage('devices'); window.setTimeout(function(){ var s=q('mcm5GroupFilter'); if(s){s.value=b.dataset.mcm7Group;s.dispatchEvent(new Event('change',{bubbles:true}));} },100); }; });
    qa('[data-node]',root).forEach(function(b){ b.onclick=function(){ openNodeInDevicePage(b.dataset.node); }; });
  }

  function openNodeInDevicePage(id) {
    var n=nodeMap()[id]; if(!n) return;
    showPage('devices');
    window.setTimeout(function(){ var input=q('mcm5LocalSearch')||q('mcm5GlobalSearch'); if(input){input.value=nodeName(n);input.dispatchEvent(new Event('input',{bubbles:true}));} window.setTimeout(function(){var row=document.querySelector('.mcm5-device-row[data-nodeid="'+CSS.escape(id)+'"]');if(row&&row.click)row.click();},150); },100);
  }

  function playbooks() {
    return [
      {id:'offline-ticket',icon:'!',title:'Offline persistente → ticket',desc:'Quando um endpoint ficar offline além do limite, criar incidente e anexar contexto.',needs:'Worker + histórico de lastconnect',level:'safe'},
      {id:'subnet-group',icon:'⌘',title:'Auto-organizar por subnet',desc:'Mover automaticamente máquinas para o grupo/local correto com base no IP.',needs:'Worker + moveDeviceGroup',level:'safe'},
      {id:'disk-clean',icon:'▰',title:'Disco baixo → limpeza',desc:'Detectar baixo espaço e executar playbook de limpeza antes de abrir chamado.',needs:'Coleta de disco + RunCommand',level:'guarded'},
      {id:'service-restart',icon:'↻',title:'Serviço parado → restart',desc:'Reiniciar serviços conhecidos e validar o resultado automaticamente.',needs:'Script de health check + RunCommand',level:'guarded'},
      {id:'reconnect-diag',icon:'◇',title:'Reconectou → diagnóstico',desc:'Após reconexão, coletar rede, sysinfo e checks básicos para acelerar triagem.',needs:'Eventos + sysinfo/networkinfo',level:'safe'},
      {id:'amt-fallback',icon:'⚡',title:'Falha de agente → AMT',desc:'Destacar equipamentos com AMT disponível quando o agente estiver indisponível.',needs:'Estado Agent + Intel AMT',level:'safe'}
    ];
  }

  function simulateRule(rule) {
    var list=nodes();
    if(rule.trigger==='offline') return list.filter(function(n){return !online(n);});
    if(rule.trigger==='noagent') return list.filter(function(n){return !n.agent;});
    if(rule.trigger==='amtmissing') return list.filter(function(n){return !n.intelamt;});
    if(rule.trigger==='subnet') return list.filter(function(n){return nodeIp(n).indexOf(rule.value||'')===0;});
    return [];
  }

  function renderAutomation() {
    var host=q('mcm7AutomationBody');if(!host)return;
    var rules=jsonGet(RULES_KEY,[]);
    host.innerHTML='<section class="mcm7-auto-status"><div><span class="dot"></span><div><b>Automation Worker</b><small>Não ativado neste servidor. A interface está em modo design/simulação.</small></div></div><span>DRY-RUN / SAFE</span></section><section class="mcm7-auto-grid">'+playbooks().map(function(p){return '<article class="mcm7-playbook"><span class="icon">'+p.icon+'</span><div><b>'+esc(p.title)+'</b><p>'+esc(p.desc)+'</p><small>'+esc(p.needs)+'</small></div><button data-template="'+p.id+'">Usar modelo</button></article>';}).join('')+'</section><section class="mcm7-rules"><header><div><b>Regras em desenho</b><small>Persistidas apenas no navegador até o worker ser implantado.</small></div><span>'+rules.length+' regras</span></header><div>'+ (rules.length?rules.map(function(r,i){var matched=simulateRule(r).length;return '<article><div><span class="status"></span><div><b>'+esc(r.name)+'</b><small>'+esc(r.trigger)+' → '+esc(r.action)+'</small></div></div><strong>'+matched+' agora</strong><button data-sim="'+i+'">Simular</button><button data-del="'+i+'">Excluir</button></article>';}).join(''):'<div class="mcm7-empty">Nenhuma regra criada. Comece por um playbook ou crie uma regra.</div>')+'</div></section>';
    qa('[data-template]',host).forEach(function(b){b.onclick=function(){openRuleModal(b.dataset.template);};});
    qa('[data-del]',host).forEach(function(b){b.onclick=function(){var a=jsonGet(RULES_KEY,[]);a.splice(Number(b.dataset.del),1);jsonSet(RULES_KEY,a);renderAutomation();};});
    qa('[data-sim]',host).forEach(function(b){b.onclick=function(){var r=jsonGet(RULES_KEY,[])[Number(b.dataset.sim)];alert('Simulação: '+simulateRule(r).length+' dispositivos correspondem à condição agora. Nenhuma ação foi executada.');};});
  }

  function openRuleModal(template) {
    var modal=q('mcm7RuleModal'); if(!modal)return;
    var defaults={
      'offline-ticket':['Offline persistente → ticket','offline','','notify'],
      'subnet-group':['Auto-organizar por subnet','subnet','10.','movegroup'],
      'disk-clean':['Disco baixo → limpeza','offline','','runcommand'],
      'service-restart':['Serviço parado → restart','offline','','runcommand'],
      'reconnect-diag':['Reconectou → diagnóstico','offline','','diagnostics'],
      'amt-fallback':['Agente indisponível com AMT','noagent','','notify']
    }[template]||['','','','notify'];
    q('mcm7RuleName').value=defaults[0];q('mcm7RuleTrigger').value=defaults[1]||'offline';q('mcm7RuleValue').value=defaults[2];q('mcm7RuleAction').value=defaults[3];modal.hidden=false;
  }
  function saveRule() {
    var name=q('mcm7RuleName').value.trim();if(!name)return;
    var arr=jsonGet(RULES_KEY,[]);arr.push({id:'r'+Date.now(),name:name,trigger:q('mcm7RuleTrigger').value,value:q('mcm7RuleValue').value.trim(),action:q('mcm7RuleAction').value,created:Date.now(),enabled:false});jsonSet(RULES_KEY,arr);q('mcm7RuleModal').hidden=true;renderAutomation();
  }

  function renderActivity() {
    var host=q('mcm7ActivityBody');if(!host)return;
    var recents=jsonGet('meshcommander-v5-recents',[]), map=nodeMap(), recentNodes=recents.map(function(id){return map[id];}).filter(Boolean).slice(0,10), groups=groupHealth();
    var offline=nodes().filter(function(n){return !online(n);}).slice(0,12);
    host.innerHTML='<section class="mcm7-activity-grid"><article class="mcm7-widget"><header><div><b>Fila de indisponibilidade</b><small>Endpoints atualmente offline</small></div><span>'+offline.length+' exibidos</span></header><div class="mcm7-activity-list">'+(offline.length?offline.map(activityNode).join(''):'<div class="mcm7-empty">Sem dispositivos offline.</div>')+'</div></article><article class="mcm7-widget"><header><div><b>Acessados recentemente</b><small>Histórico local do Command Center</small></div></header><div class="mcm7-activity-list">'+(recentNodes.length?recentNodes.map(activityNode).join(''):'<div class="mcm7-empty">Nenhum acesso recente registrado.</div>')+'</div></article><article class="mcm7-widget wide"><header><div><b>Grupos com maior impacto</b><small>Ordenados por quantidade de endpoints offline</small></div></header>'+stackedGroups(groups)+'</article></section>';
    qa('[data-node]',host).forEach(function(b){b.onclick=function(){openNodeInDevicePage(b.dataset.node);};});
    qa('[data-mcm7-group]',host).forEach(function(b){b.onclick=function(){showPage('devices');window.setTimeout(function(){var s=q('mcm5GroupFilter');if(s){s.value=b.dataset.mcm7Group;s.dispatchEvent(new Event('change',{bubbles:true}));}},100);};});
  }
  function activityNode(n){return '<button data-node="'+esc(n._id)+'"><span class="state '+(online(n)?'online':'offline')+'"></span><div><b>'+esc(nodeName(n))+'</b><small>'+esc(meshName(n))+' · '+esc(nodeIp(n))+'</small></div><strong>'+ (online(n)?'Online':'Offline') +'</strong></button>';}

  function bindGlobal() {
    q('mcm7PrimaryNav').onclick=function(e){var b=e.target.closest('[data-page]');if(!b)return;var p=b.dataset.page;if(p==='more'){var m=q('mcm7MoreMenu');m.hidden=!m.hidden;return;}showPage(p);};
    q('mcm7MoreMenu').onclick=function(e){var b=e.target.closest('button');if(!b)return;q('mcm7MoreMenu').hidden=true;if(b.dataset.nativeView){var native=q('mcm5NativeView');if(native&&native.click)native.click();return;}var id=b.dataset.native;if(id){hideV5Pages();var hidden=document.querySelector('.mcm5-navitem[data-native="'+id+'"]');if(hidden&&hidden.click)hidden.click();setTopActive('more');}};
    q('mcm7Refresh').onclick=function(){sampleAvailability();renderDashboard();};
    q('mcm7NewRule').onclick=function(){openRuleModal();};
    q('mcm7RuleClose').onclick=q('mcm7RuleCancel').onclick=function(){q('mcm7RuleModal').hidden=true;};
    q('mcm7RuleSave').onclick=saveRule;
    document.addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.shiftKey&&e.key.toLowerCase()==='a'){e.preventDefault();showPage('automation');}});
  }

  function enhance() {
    var shell=q('mcmV5Shell'); if(!shell)return false;
    if(shell.classList.contains('mcm7-shell'))return true;
    shell.classList.add('mcm7-shell');
    document.documentElement.setAttribute('data-mc-modern-overlay',VERSION);
    addTopNavigation(shell);buildPages();bindGlobal();sampleAvailability();showPage('dashboard');
    renderTimer=window.setInterval(function(){if(currentPage==='dashboard')renderDashboard();if(currentPage==='activity')renderActivity();},10000);
    sampleTimer=window.setInterval(function(){sampleAvailability();if(currentPage==='dashboard')renderDashboard();},60000);
    return true;
  }

  var tries=0;(function wait(){tries++;if(enhance()||tries>60)return;window.setTimeout(wait,150);})();
})();
